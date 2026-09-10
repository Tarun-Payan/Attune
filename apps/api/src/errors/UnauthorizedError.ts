import { AppError, type ErrorDetails } from "./AppError";

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details?: ErrorDetails) {
    super(401, message, "UNAUTHORIZED", details);
  }
}
