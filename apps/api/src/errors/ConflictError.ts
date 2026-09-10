import { AppError, type ErrorDetails } from "./AppError";

export class ConflictError extends AppError {
  constructor(message = "Conflict with existing resource", details?: ErrorDetails) {
    super(409, message, "CONFLICT", details);
  }
}
