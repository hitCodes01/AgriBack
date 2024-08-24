import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Derive __dirname using fileURLToPath and dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths to necessary files and directories
const ffmpegPath = path.join(__dirname, 'bin', 'ffmpeg', 'ffmpeg');
const rhubarbPath = path.join(__dirname, 'bin', 'rhubarb', 'rhubarb');
const tmpDir = '/tmp';
const audioDir = path.join(__dirname, 'audios');

// Function to check if a file exists
const checkFileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    console.log(`Found: ${filePath}`);
  } catch (error) {
    console.error(`Missing: ${filePath}`);
    process.exit(1);
  }
};

// Function to check if a directory exists
const checkDirectoryExists = async (dirPath) => {
  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) {
      throw new Error('Not a directory');
    }
    console.log(`Directory exists: ${dirPath}`);
  } catch (error) {
    console.error(`Directory not found or not a directory: ${dirPath}`);
    process.exit(1);
  }
};

// Function to check if an environment variable is set
const checkEnvVar = (varName) => {
  if (!process.env[varName]) {
    console.error(`Missing environment variable: ${varName}`);
    process.exit(1);
  }
  console.log(`Environment variable ${varName} is set`);
};

// Run checks
(async () => {
  console.log('Running checks...');

  // Check required files
  await checkFileExists(ffmpegPath);
  await checkFileExists(rhubarbPath);

  // Check /tmp directory
  await checkDirectoryExists(tmpDir);

  // Check audios directory (optional, remove if not required)
  await checkDirectoryExists(audioDir);

  // Check required environment variables
  checkEnvVar('OPENAI_API_KEY');
  checkEnvVar('PORT');

  console.log('All checks passed. Ready to start the application.');
})();
