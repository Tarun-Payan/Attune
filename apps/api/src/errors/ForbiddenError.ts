import { AppError, type ErrorDetails } from "./AppError";

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details?: ErrorDetails) {
    super(403, message, "FORBIDDEN", details);
  }
}
