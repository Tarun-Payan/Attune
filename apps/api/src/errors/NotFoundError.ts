import { AppError, type ErrorDetails } from "./AppError";

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: ErrorDetails) {
    super(404, message, "NOT_FOUND", details);
  }
}
