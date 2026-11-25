const multer = require("multer");
const path = require("path");

const allowedTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const fileFilter = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.get(extension) === file.mimetype) {
    return callback(null, true);
  }
  callback(new Error("Format refusé. Joignez une image JPG, PNG ou WEBP."));
};

module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 1,
    fields: 1,
    fieldSize: 5000,
    parts: 2,
  },
});
