import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors/AppError";

/**
 * Centralized Fastify error handler.
 * Maps domain errors (AppError), validation errors, and unexpected exceptions
 * into consistent, secure API responses.
 */
export function errorHandler(err: FastifyError | AppError | Error, req: FastifyRequest, reply: FastifyReply) {
  // 1) Domain Application Errors
  if (err instanceof AppError) {
    const responseBody: Record<string, unknown> = {
      error: err.message,
      code: err.code,
      ...err.details,
    };

    if (err.statusCode >= 500) {
      req.log.error({ err, statusCode: err.statusCode }, "Application operational error");
    } else {
      req.log.warn({ err: { name: err.name, message: err.message, code: err.code }, statusCode: err.statusCode }, "Client error");
    }

    return reply.code(err.statusCode).send(responseBody);
  }

  // 2) Fastify Schema Validation Errors
  const fastifyErr = err as FastifyError;
  if (fastifyErr.validation || (fastifyErr.statusCode && fastifyErr.statusCode === 400)) {
    req.log.warn({ err: fastifyErr }, "Schema validation error");
    return reply.code(400).send({
      error: fastifyErr.message || "Invalid request parameters",
      code: "VALIDATION_ERROR",
    });
  }

  // 3) Known HTTP Status Codes (e.g. 401, 403, 404, 429 from plugins)
  if (fastifyErr.statusCode && fastifyErr.statusCode >= 400 && fastifyErr.statusCode < 500) {
    req.log.warn({ err: fastifyErr }, "HTTP client error");
    return reply.code(fastifyErr.statusCode).send({
      error: fastifyErr.message,
      code: "CLIENT_ERROR",
    });
  }

  // 4) Unexpected / 500 Internal Server Errors
  req.log.error({ err }, "Unhandled server error");
  const isDev = process.env.NODE_ENV !== "production";
  return reply.code(500).send({
    error: isDev ? err.message : "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
  });
}
