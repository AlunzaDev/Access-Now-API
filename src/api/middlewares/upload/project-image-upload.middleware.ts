import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ErrorService } from "../errors/error-handler";

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) =>
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
}).single("imagen");

export const uploadProjectImage = (request: Request, response: Response, next: NextFunction) => {
  imageUpload(request, response, (error) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return ErrorService.send(response, 413, "La imagen no debe superar 5 MB");
    }
    if (error) return ErrorService.send(response, 400, "La imagen debe ser JPG, PNG o WebP");
    if (!request.file) {
      return ErrorService.send(response, 400, "El campo 'imagen' es requerido y debe ser JPG, PNG o WebP");
    }
    return next();
  });
};
