/**
 * Module to deal with discovering available endpoints
 */
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import cache from 'cache';
import * as qs from 'qs';
import * as base64JS from 'base64-js';
import { AIMSSessionDescriptor, AIMSAccount } from './types/aims-stub.types';
import { AlLocatorService, AlRequestDescriptor, AlLocationDescriptor, AlTriggerStream } from './utility';
import { AlClientBeforeRequestEvent } from './events';

interface AlApiTarget {
  host: string;
  path: string;
}

/**
 * AlEndpointTarget defines the minimum data to use endpoints to resolve an API base location
 */
export interface APIRequestParams {
  location_strategy?:string;
  account_id?: string;
  residency?: string;
  service_name?: string;
  endpoint_type?: string;
  version?: string;
  data?: any;
  path?: string;
  params?: any;
  ttl?: number;
  accept_header?: string;
  response_type?: string;
}

export class AlApiClient
{
  public events:AlTriggerStream = new AlTriggerStream();
  public verbose:boolean = false;

  /**
   * Service specific fallback params
   * ttl is 1 minute by default, consumers can set cache duration in requests
   */
  private defaultParams: APIRequestParams = {
    location_strategy:  "insight/endpoints",
    account_id:         '0',
    residency:          'default',       // ("us" or "emea" or "default")
    service_name:       'aims',         // ("api" or "ui")
    endpoint_type:      'api',
    version:            'v1',
    data:               {},
    path:               '',
    params:             {},
    ttl:                60000,
  };

  private cache = new cache(60000);

  constructor() {
  }

  /**
   * Create a default Discovery Response for Global Stack
   */
  public getDefaultEndpoint() {
    let response = { global: 'api.global-services.global.alertlogic.com' };
    if (this.isBrowserBased()) {
      /**
       * Do some machinations to find out if we are in Production or Integration
       */
      let tld = window.location.hostname;
      tld = tld.toString();
      if ( tld === 'localhost' || tld.match(/product.dev.alertlogic.com/gi) !== null ) {
        response = { global: 'api.global-integration.product.dev.alertlogic.com' };
      }
    }
    return response;
  }

  /**
   * Ensure that the params object is always fully populated for URL construction
   */
  public mergeParams(params: APIRequestParams) {
    return Object.assign( {}, this.defaultParams, params );
  }

  /**
   * Instantiate a properly configured axios client for services
   */
  public getAxiosInstance(): AxiosInstance {
    let headers = {
      'Accept': 'application/json, text/plain, */*'
    };
    const axiosInstance = axios.create({
      baseURL: this.getDefaultEndpoint().global,
      timeout: 5000,
      withCredentials: false,
      headers: headers,
    });
    axiosInstance.interceptors.request.use(
      config => {
        this.events.trigger( new AlClientBeforeRequestEvent( config ) );        //    Allow event subscribers to modify the request (e.g., add a session token header) if they want
        return config;
      }
    );
    axiosInstance.interceptors.response.use(
      response => response,
      (error) => {
        return Promise.reject(error.response);
      });
    return axiosInstance;
  }

  /**
   * Get endpoint
   * GET
   * /endpoints/v1/:account_id/residency/:residency/services/:service_name/endpoint/:endpoint_type
   * https://api.global-services.global.alertlogic.com/endpoints/v1/01000001/residency/default/services/incidents/endpoint/ui
   */
  public async getEndpoint(params: APIRequestParams): Promise<AxiosResponse<any>> {
    params = this.mergeParams(params);
    const defaultEndpoint = this.getDefaultEndpoint();
    const uri = `/endpoints/v1/${params.account_id}/residency/default/services/${params.service_name}/endpoint/${params.endpoint_type}`;
    const testCache = this.cache.get(uri);
    const xhr = this.getAxiosInstance();
    xhr.defaults.baseURL = `https://${defaultEndpoint.global}`;
    if (!testCache) {
      this.log(`APIClient:Endpoints: retrieving ${params.service_name}/${params.endpoint_type} from origin`);
      return await xhr.get(uri).then((response) => {
        const ttl = 15 * 60000; // cache our endpoints response for 15 mins
        this.cache.put(uri, response, ttl);
        this.log(`APIClient:Endpoints: ${params.service_name}/${params.endpoint_type} is `, response.data );
        return response;
      });
    } else {
      return this.cache.get(uri);
    }
  }

  public async calculateURIFromEndpoints( params: APIRequestParams ):Promise<AlApiTarget> {
    params = this.mergeParams(params);
    const queryParams = qs.stringify(params.params);
    const defaultEndpoint = this.getDefaultEndpoint();
    let fullPath = `/${params.service_name}/${params.version}`;
    if (params.account_id !== '0') {
      fullPath = `${fullPath}/${params.account_id}`;
    }
    if (params.hasOwnProperty('path')) {
      fullPath = `${fullPath}${params.path}`;
    }
    if (queryParams.length > 0) {
      fullPath = `${fullPath}?${queryParams}`;
    }
    const endpoint: AlApiTarget = await this.getEndpoint(params)
      .then(serviceURI => ({ host: `https://${serviceURI.data[params.service_name]}`, path: fullPath }))
      .catch(() => ({ host: `https://${defaultEndpoint.global}`, path: fullPath }));
    return endpoint;
  }

  public async calculateURI(params: APIRequestParams):Promise<AlApiTarget> {
      return this.calculateURIFromEndpoints( params );
  }

  /**
   * Return Cache, or Call for updated data
   */
  public async get(params: APIRequestParams) {
    const uri = await this.calculateURI(params);
    let testCache = this.cache.get(uri.path);
    const xhr = this.getAxiosInstance();
    xhr.defaults.baseURL = uri.host;
    if (params.accept_header) {
      xhr.defaults.headers.Accept = params.accept_header;
    }
    if (params.response_type) {
      xhr.defaults.responseType = params.response_type;
    }
    let originalDataResponse = null;
    if (!testCache) {
      this.log("APIClient::XHR GET %s %s", uri.host, uri.path );
      await xhr.get(uri.path)
        .then((response) => {
          originalDataResponse = response.data;
          this.cache.put(uri.path, response.data, params.ttl);
        });
    }
    testCache = this.cache.get(uri.path);
    return testCache ? testCache : originalDataResponse;
  }

  /**
   * Alias for GET utility method
   */
  async fetch(params: APIRequestParams) {
    return this.get( params );
  }

  /**
   * Post for new data
   */
  async post(params: APIRequestParams) {
    const uri = await this.calculateURI(params);
    const xhr = this.getAxiosInstance();
    xhr.defaults.baseURL = uri.host;
    this.cache.del(uri.path);
    this.log("APIClient::XHR POST %s %s", uri.host, uri.path );
    return await xhr.post(uri.path, params.data)
      .then(response => response.data);
  }

  /**
   * Put for updated data
   */
  async put(params: APIRequestParams) {
    const uri = await this.calculateURI(params);
    const xhr = this.getAxiosInstance();
    xhr.defaults.baseURL = uri.host;
    this.cache.del(uri.path);
    this.log("APIClient::XHR PUT %s %s", uri.host, uri.path );
    return await xhr.put(uri.path, params.data)
      .then(response => response.data);
  }

  /**
   * Alias for PUT utility method
   */
  async set( params:APIRequestParams ) {
    return this.put( params );
  }

  /**
   * Delete data
   */
  async delete(params: APIRequestParams) {
    const uri = await this.calculateURI(params);
    const xhr = this.getAxiosInstance();
    xhr.defaults.baseURL = uri.host;
    this.cache.del(uri.path);
    this.log("APIClient::XHR DELETE %s %s", uri.host, uri.path );
    return await xhr.delete(uri.path)
      .then(response => response.data);
  }

  /**
   * Create a request descriptor interface
   */
  public request<ResponseType>( method:string ):AlRequestDescriptor<ResponseType> {
    const descriptor = new AlRequestDescriptor<ResponseType>( this.executeRequest, method );
    return descriptor;
  }

  public executeRequest<ResponseType>( options:any ):Promise<AxiosResponse<ResponseType>> {
     const xhr = this.getAxiosInstance();
     return xhr.request( options );
  }

  public setLocations( locations:AlLocationDescriptor[], actingUri:string|boolean = true ) {
    AlLocatorService.setLocations( locations );
    AlLocatorService.setActingUri( actingUri );
  }

  public resolveLocation( locTypeId:string, path:string = null ) {
    let node = AlLocatorService.getNode( locTypeId );
    if ( ! node ) {
        throw new Error(`Cannot resolve location with locTypeId '${locTypeId}'` );
    }
    let uri = AlLocatorService.resolveNodeURI( node );
    if ( path ) {
        uri += path;
    }
    return uri;
  }

  /**
   * Use HTTP Basic Auth
   * Optionally supply an mfa code if the user account is enrolled for Multi-Factor Authentication
   */
  async authenticate( user: string, pass: string, mfa?:string ):Promise<AIMSSessionDescriptor> {
    const uri = await this.calculateURI({service_name: 'aims', path: '/authenticate'});
    const xhr = this.getAxiosInstance();
    xhr.defaults.baseURL = uri.host;
    xhr.defaults.headers.common.Authorization = `Basic ${this.base64Encode(`${user}:${pass}`)}`;
    let payload = {};
    if (mfa) {
      payload = { mfa_code: mfa };
    }
    return xhr.post(uri.path, mfa )
      .then((res) => {
        return res.data;
      });
  }

  /**
   * Authenticate with an mfa code and a temporary session token.
   * Used when a user inputs correct username:password but does not include mfa code when they are enrolled for Multi-Factor Authentication
   * The session token can be used to complete authentication without re-entering the username and password, but must be used within 3 minutes (token expires)
   */
  async authenticateWithMFASessionToken(token: string, mfa: string):Promise<AIMSSessionDescriptor> {
    const uri = await this.calculateURI({service_name: 'aims', path: '/authenticate'});
    const xhr = this.getAxiosInstance();
    xhr.defaults.baseURL = uri.host;
    xhr.defaults.headers.common['X-AIMS-Session-Token'] = token;
    const mfaCode = `{ "mfa_code": "${mfa}" }`;
    return xhr.post(uri.path, mfaCode)
      .then((res) => {
        return res.data as AIMSSessionDescriptor;
      });
  }

  /**
   * Converts a string input to its base64 encoded equivalent.  Uses browser-provided btoa if available, or 3rd party btoa module as a fallback.
   */
  public base64Encode( data:string ):string {
    if ( this.isBrowserBased() && window.btoa ) {
        return btoa( data );
    }
    let utf8Data = unescape( encodeURIComponent( data ) );        //  forces conversion to utf8 from utf16, because...  not sure why
    let bytes = [];
    for ( let i = 0; i < utf8Data.length; i++ ) {
      bytes.push( utf8Data.charCodeAt( i ) );
    }
    let result = base64JS.fromByteArray( bytes );
    return result;
  }

  /**
   * Are we running in a browser?
   */
  private isBrowserBased() {
    if (typeof window === 'undefined') {
      return false;
    }
    return true;
  }

  private log( text:string, ...otherArgs:any[] ) {
      if ( this.verbose ) {
          console.log.apply( console, arguments );
      }
  }
}

/* tslint:disable:variable-name */
export const AlDefaultClient = new AlApiClient();
