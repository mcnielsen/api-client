import { ALClient } from '../src/index';
import { expect } from 'chai';
import { describe, before } from 'mocha';
import xhrMock, { once } from 'xhr-mock';
import * as qs from 'qs';

const defaultAuthResponse = {
  authentication: {
    user: {
      id: '715A4EC0-9833-4D6E-9C03-A537E3F98D23',
      name: 'Bob Dobalina',
      email: 'bob@company.com',
      active: true,
      locked: false,
      version: 1,
      created: {
        at: 1430183768,
        by: 'System',
      },
      modified: {
        at: 1430183768,
        by: 'System',
      },
    },
    account: {
      id: '12345678',
      name: 'Company Name',
      active: true,
      version: 1,
      accessible_locations: ['insight-us-virginia'],
      default_location: 'insight-us-virginia',
      created: {
        by: 'system',
        at: 1436482061,
      },
      modified: {
        by: 'system',
        at: 1436482061,
      },
    },
    token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9==.QKRHma5zAOdhU50ZE4ryPxVpvKt0A0gbjY62xHCWm8s=',
    token_expiration: + new Date() + 1000,
  },
};

beforeEach(() => xhrMock.setup());
afterEach(() => xhrMock.teardown());

describe('When determining an endpoint for a given service', () => {
  it('should return the resolved endpoint from the service', async () => {
    const serviceName = 'cargo';
    const responseBody = {};
    responseBody[serviceName] = 'blaaa';
    xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/endpoints/v1/0/residency/default/services/cargo/endpoint/api', {
      status: 200,
      body: JSON.stringify(responseBody),
    });
    const endpoint = await ALClient.getEndpoint({ service_name: serviceName });
    expect(endpoint.data).to.deep.equals(responseBody);
  });
});

describe('When creating a URI for a given service ', () => {
  describe('with no params supplied', () => {
    it('should fallback to request and returning the endpoint for the AIMS service', async () => {
      const serviceName = 'aims';
      const serviceEndpoint = 'api.global-integration.product.dev.alertlogic.com';
      const responseBody = {};
      responseBody[serviceName] = serviceEndpoint;
      xhrMock.get(`https://api.global-integration.product.dev.alertlogic.com/endpoints/v1/0/residency/default/services/${serviceName}/endpoint/api`, {
        status: 200,
        body: JSON.stringify(responseBody),
      });
      const endpoint = await ALClient.calculateURI({});
      expect(endpoint).to.deep.equals({
        host: `https://${serviceEndpoint}`,
        path: `/${serviceName}/v1`,
      });
    });
  });
  describe('with a service name, account_id and query params supplied', () => {
    it('should return an endpoint response containing a correctly constructed path', async () => {
      const serviceName = 'cargo';
      const queryParams = { foo: 'bar' };
      const accountID = '2';
      const serviceEndpoint = 'api.global-integration.product.dev.alertlogic.com';
      const responseBody = {};
      responseBody[serviceName] = serviceEndpoint;
      xhrMock.get(`https://api.global-integration.product.dev.alertlogic.com/endpoints/v1/${accountID}/residency/default/services/${serviceName}/endpoint/api`, {
        status: 200,
        body: JSON.stringify(responseBody),
      });
      const endpoint = await ALClient.calculateURI({ service_name: serviceName, account_id: accountID, params: queryParams });
      expect(endpoint).to.deep.equals({
        host: `https://${serviceEndpoint}`,
        path: `/${serviceName}/v1/${accountID}?${qs.stringify(queryParams)}`,
      });
    });
  });
  describe('and an exception is thrown from the backend service', () => {
    it('should return an endpoint response containing the default global endpoint', async () => {
      xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/endpoints/v1/0/residency/default/services/aims/endpoint/api', {
        status: 500,
        body: '',
      });
      const endpoint = await ALClient.calculateURI({});
      expect(endpoint).to.deep.equals({
        host: 'https://api.global-integration.product.dev.alertlogic.com',
        path: '/aims/v1',
      });
    });
  });
});

describe('When performing two fetch operations', () => {
  beforeEach(() => {
    // mock out endpoints call first
    const serviceName = 'aims';
    const serviceEndpoint = 'api.global-integration.product.dev.alertlogic.com';
    const responseBody = {};
    responseBody[serviceName] = serviceEndpoint;
    xhrMock.get(`https://api.global-integration.product.dev.alertlogic.com/endpoints/v1/0/residency/default/services/${serviceName}/endpoint/api`, {
      status: 200,
      body: JSON.stringify(responseBody),
    });
  });

  describe(' with the TTL overridden zero ms', () => {
    it('should return the most recently received server response', async () => {
      // Here we mock out a second response from back end...
      xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1', once({
        status: 200,
        body: 'first response',
      }));
      await ALClient.fetch({ ttl:0 });
      xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1', once({
        status: 200,
        body: 'second response',
      }));
      const response = await ALClient.fetch({ ttl:0 });
      expect(response).to.equal('second response');
    });
  });
  describe('with no TTL override value supplied', () => {
    it('should return the first server response', async () => {
      xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1', once({
        status: 200,
        body: 'first response',
      }));
      await ALClient.fetch({ });
      xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1', once({
        status: 200,
        body: 'second response',
      }));
      const response = await ALClient.fetch({ });
      expect(response).to.equal('first response');
    });
  });
});

describe('When authenticating a user with credentials', () => {
  const username = 'bob@email.com';
  const password = 'IAmNotAValidUser!@#$';
  const mfaCode = '123456';
  beforeEach(() => {
    // mock out endpoints call first
    const serviceName = 'aims';
    const serviceEndpoint = 'api.global-integration.product.dev.alertlogic.com';
    const responseBody = {};
    responseBody[serviceName] = serviceEndpoint;
    xhrMock.get(`https://api.global-integration.product.dev.alertlogic.com/endpoints/v1/0/residency/default/services/${serviceName}/endpoint/api`, {
      status: 200,
      body: JSON.stringify(responseBody),
    });
  });
  xdescribe('but without supplying an mfa code', () => {
    it('should perform the authenticate request and set underlying session details using the response returned', async() => {
      xhrMock.post('https://api.global-integration.product.dev.alertlogic.com/aims/v1/authenticate', (req, res) => {
        expect(req.header('Authorization')).to.equal(`Basic ${btoa(unescape(encodeURIComponent(`${username}:${password}`)))}`);
        expect(req.body()).to.equal('');
        return res.status(200).body(defaultAuthResponse);
      });
      await ALClient.authenticate(username, password);
        //      expect(ALClient.getAuthentication().user).to.deep.equals(defaultAuthResponse.authentication.user);
    });
  });
  xdescribe('and an mfa code supplied', () => {
    it('should perform the authenticate request and include an mfa_code request body parameter', async() => {
      xhrMock.post('https://api.global-integration.product.dev.alertlogic.com/aims/v1/authenticate', (req, res) => {
        expect(req.header('Authorization')).to.equal(`Basic ${btoa(unescape(encodeURIComponent(`${username}:${password}`)))}`);
        expect(req.body()).to.equal(`{ "mfa_code": "${mfaCode}" }`);
        return res.status(200).body(defaultAuthResponse);
      });
      await ALClient.authenticate(username, password, mfaCode);
        // expect(ALClient.getAuthentication().user).to.deep.equals(defaultAuthResponse.authentication.user);
    });
  });
});

describe('When authenticating a user with a session token and mfa code', () => {
  const sessionToken = 'Ses1ion.Tok3n==';
  const mfaCode = '123456';
  beforeEach(() => {
    // mock out endpoints call first
    const serviceName = 'aims';
    const serviceEndpoint = 'api.global-integration.product.dev.alertlogic.com';
    const responseBody = {};
    responseBody[serviceName] = serviceEndpoint;
    xhrMock.get(`https://api.global-integration.product.dev.alertlogic.com/endpoints/v1/0/residency/default/services/${serviceName}/endpoint/api`, {
      status: 200,
      body: JSON.stringify(responseBody),
    });
  });
  it('should perform the authenticate request using the session token as a header and mfa code as a body param', async() => {
    xhrMock.post('https://api.global-integration.product.dev.alertlogic.com/aims/v1/authenticate', (req, res) => {
      expect(req.header('X-AIMS-Session-Token')).to.equal(sessionToken);
      expect(req.body()).to.equal(`{ "mfa_code": "${mfaCode}" }`);
      return res.status(200).body(defaultAuthResponse);
    });
    await ALClient.authenticateWithMFASessionToken(sessionToken, mfaCode);
  });
});
