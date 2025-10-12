// Chemin : backend/src/cityinfo/multer.config.ts

import { diskStorage } from 'multer';
import { extname } from 'path';

// Configuration de Multer pour l'upload des photos
export const multerConfig = {
  storage: diskStorage({
    destination: './uploads/mayor-photos', // Même dossier pour toutes les photos municipales
    filename: (req, file, callback) => {
      // Générer un nom unique pour chaque fichier
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      
      // ✨ MODIFIÉ : Détecter le type de photo
      let prefix = 'photo';
      if (file.fieldname === 'mayorPhoto') {
        prefix = 'mayor';
      } else if (file.fieldname === 'teamMemberPhoto') {
        prefix = 'team-member';
      }
      
      const filename = `${prefix}-${uniqueSuffix}${ext}`;
      callback(null, filename);
    },
  }),
  fileFilter: (req, file, callback) => {
    // Accepter seulement les images
    if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
      return callback(new Error('Seules les images sont autorisées !'), false);
    }
    callback(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite de 5 MB
  },
};