import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary
const configureCloudinary = () => {
  cloudinary.config({ 
    cloud_name: "dcnp4uuxr",
    api_key: "155881997971565",
    api_secret: "XUKLt_edV0XAnKG5NIEiKnNCDr4"
  });
};
// const configureCloudinary = () => {
//   cloudinary.config({ 
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET
//   });
// };

// Initialize configuration
configureCloudinary();

// Cloudinary service object
const cloudinaryService = {
  uploadToCloudinary: async (localFilePath) => {
    try {
      if (!localFilePath) return null;
      
      const response = await cloudinary.uploader.upload(localFilePath, {
        resource_type: "auto",
        folder: "fertilizer_shop"
      });
      
      fs.unlinkSync(localFilePath);
      return response;
    } catch (error) {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
      console.error('Cloudinary upload error:', error);
      return null;
    }
  },

  deleteFromCloudinary: async (publicId) => {
    try {
      if (!publicId) return;
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Cloudinary delete error:', error);
    }
  }
};

export default cloudinaryService;