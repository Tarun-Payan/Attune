import { describe, expect, it } from "vitest";
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from "./index";

describe("Domain Error Classes", () => {
  it("creates a BadRequestError with default status 400", () => {
    const err = new BadRequestError("Invalid input");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("Invalid input");
    expect(err.isOperational).toBe(true);
  });

  it("creates an UnauthorizedError with status 401", () => {
    const err = new UnauthorizedError("Session expired");
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Session expired");
  });

  it("creates a ForbiddenError with status 403", () => {
    const err = new ForbiddenError("Forbidden resource");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("creates a NotFoundError with status 404", () => {
    const err = new NotFoundError("User not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("creates a ConflictError with status 409", () => {
    const err = new ConflictError("Email already exists");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("creates a ValidationError with status 400 and field details", () => {
    const err = new ValidationError("Validation failed", { email: "Invalid email" });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details?.fields).toEqual({ email: "Invalid email" });
  });

  it("creates a ServiceUnavailableError with status 503", () => {
    const err = new ServiceUnavailableError("OAuth not configured", { hint: "Set CLIENT_ID" });
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe("SERVICE_UNAVAILABLE");
    expect(err.details?.hint).toBe("Set CLIENT_ID");
  });
});
