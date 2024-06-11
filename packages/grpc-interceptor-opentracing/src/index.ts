import { Tracer, globalTracer, FORMAT_HTTP_HEADERS, Span, Tags } from 'opentracing';
import { Interceptor } from '@brandonxiang/ges';
import '@grpc/grpc-js'

declare module '@grpc/grpc-js' {
  interface ServerUnaryCall<RequestType, ResponseType> {
    span?: Span;
  }
  interface ServerWritableStream<RequestType, ResponseType> {
    span?: Span;
  }
  interface ServerReadableStream<RequestType, ResponseType> {
    span?: Span;
  }
  interface ServerDuplexStream<RequestType, ResponseType> {
    span?: Span;
  }
}

/** opentracing interceptor
 * extract parent span from metadata and chian on it
 * @param {Tracer} [tracer] If omitted, global tracer would be used
 */
export default function opentracing(options?: { tracer?: Tracer }): Interceptor {
  return async (ctx, next) => {
    if (ctx.call.span) {
      return next();
    }

    const {
      call,
      definition: { path },
    } = ctx;
    const tracer = (options && options.tracer) || globalTracer();

    const { metadata } = call;

    const parent = tracer.extract(FORMAT_HTTP_HEADERS, metadata.getMap());

    const span = tracer.startSpan(path, parent ? { childOf: parent } : undefined);

    // expose span
    call.span = span;

    ctx.onFinished((error: Error | null) => {
      if (error) {
        span.addTags({
          [Tags.ERROR]: error,
        });
      }
      span.finish();
    });

    await next();
  };
}
