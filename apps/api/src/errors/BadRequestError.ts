import { AppError, type ErrorDetails } from "./AppError";

export class BadRequestError extends AppError {
  constructor(message = "Bad Request", details?: ErrorDetails) {
    super(400, message, "BAD_REQUEST", details);
  }
}
