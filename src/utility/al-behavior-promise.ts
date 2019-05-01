/**
 *  AlBehaviorPromise is a simple extension of Promise that replicates the functionality provided by RxJS's BehaviorSubject.
 *  Promises already provide multicasting functionality, but it can be deucedly inconvenient to provide an inline
 *  executor, and rather obtuse to change the resolved value.
 *
 *  This class exposes the basic surface area of a Promise -- it is `then`able -- but allows the resolved value to change
 *  if necessary.
 */

export class AlBehaviorPromise<ResultType>
{
    protected promise:Promise<ResultType>;
    protected resolver:{(result:ResultType):void};
    protected rejector:{(error:any):void};
    protected resolved:boolean = false;

    constructor() {
        this.promise = new Promise<ResultType>( ( resolve, reject ) => {
            this.resolver = resolve;
            this.rejector = reject;
        } );
    }

    public then( callback, error = undefined ) {
        return this.promise.then( callback, error );
    }

    public resolve( result:ResultType ) {
        if ( ! this.resolved ) {
            this.resolver( result );
            this.resolved = true;
        } else {
            this.promise = Promise.resolve( result );
        }
    }

    public reject( error:any ) {
        this.rejector( error );
    }
}
