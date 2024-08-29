import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import axios from "axios";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "-", 
});

const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 3000;

// Route to check directory contents and specific file
app.get('/check-file', async (req, res) => {
  const directoryPath = '/var/task/Rhubarb/lib';
  const fileNameToCheck = 'CHANGELOG';

  console.log('Checking directory contents:', directoryPath);
  
  try {
    const files = await fs.readdir(directoryPath);
    console.log('Files in directory:', files);
    
    // Check if the specific file is in the directory
    const fileExists = files.includes(fileNameToCheck);
    if (fileExists) {
      console.log(`File "${fileNameToCheck}" found in directory.`);
      res.send(`File "${fileNameToCheck}" found in directory.`);
    } else {
      console.log(`File "${fileNameToCheck}" is not found in directory.`);
      res.send(`File "${fileNameToCheck}" is not found in directory.`);
    }
  } catch (err) {
    console.error('Error reading directory:', err);
    res.status(500).send('Error reading directory: ' + err.message);
  }
});

// Route to list contents of Rhubarb directory
app.get('/list-rhubarb-files', async (req, res) => {
  const rhubarbPath = path.join(__dirname, 'Rhubarb');

  console.log('Checking Rhubarb directory contents:', rhubarbPath);

  try {
    const listFiles = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const results = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push({
            type: 'directory',
            name: entry.name,
            path: fullPath,
            contents: await listFiles(fullPath),
          });
        } else {
          results.push({
            type: 'file',
            name: entry.name,
            path: fullPath,
          });
        }
      }
      return results;
    };

    const files = await listFiles(rhubarbPath);
    console.log('Files in Rhubarb directory:', files);
    res.json(files);
  } catch (err) {
    console.error('Error reading Rhubarb directory:', err);
    res.status(500).send('Error reading Rhubarb directory: ' + err.message);
  }
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${command}`, error);
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
};

// Derive __dirname using fileURLToPath and dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define paths to ffmpeg and rhubarb
const ffmpegPath = path.join(__dirname,  'FFmpeg', 'ffmpeg');
const rhubarbPath = path.join(__dirname, 'Rhubarb', 'rhubarb');

const lipSyncMessage = async (message) => {
  const time = new Date().getTime();
  console.log(`Starting conversion for message ${message}`);

  try {
    // Define paths using /tmp
    const wavPath = `/tmp/message_${message}.wav`;
    const jsonPath = `/tmp/message_${message}.json`;

    // Convert MP3 to WAV using ffmpeg
    await execCommand(
      `${ffmpegPath} -y -i /tmp/message_${message}.mp3 ${wavPath}`
    );
    console.log(`Conversion done in ${new Date().getTime() - time}ms`);

    // Generate lip-sync
    await execCommand(
      `${rhubarbPath} -f json -o ${jsonPath} ${wavPath} -r phonetic`
    );
    console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
  } catch (error) {
    console.error(`Error in lipSyncMessage for message ${message}:`, error);
    throw error;
  }
};

const generateTTSAndLipSync = async (message, index) => {
  try {
    // Define the path for the MP3 file
    const filePath = `/tmp/message_${index}.mp3`;

    // Generate audio using OpenAI TTS service
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: message,
    });

    // Convert the audio to a buffer and save it as an MP3 file
    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // Generate lip-sync
    await lipSyncMessage(index);

    // Return the file path and lip-sync data
    return {
      audio: await audioFileToBase64(filePath), // Return the audio as base64 string
      lipsync: await readJsonTranscript(`/tmp/message_${index}.json`),
    };
  } catch (error) {
    console.error(`Error in generateTTSAndLipSync for message ${message}:`, error);
    throw error;
  }
};

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    const introMessages = [
      "Hello There !! I am FutureFarm Agronomist. How can I help you today?",
    ];

    try {
      res.setHeader('Content-Type', 'application/json');

      for (const [index, message] of introMessages.entries()) {
        const { audio, lipsync } = await generateTTSAndLipSync(message, `intro_${index}`);
        
        const response = {
          text: message,
          audio,
          lipsync,
          facialExpression: "smile",
          animation: "Talking_1",
        };

        res.write(JSON.stringify({ messages: [response] }) + "\n");
      }

      res.end();
    } catch (error) {
      console.error('Error generating intro messages:', error);
      res.status(500).send({ error: 'Error generating intro messages.' });
    }
    return;
  }

  if (!openai.apiKey || openai.apiKey === "-") {
    const errorMessages = [
      "Please don't ruin Tristan with a crazy OpenAI and ElevenLabs bill!",
    ];

    try {
      res.setHeader('Content-Type', 'application/json');

      for (const [index, message] of errorMessages.entries()) {
        const { audio, lipsync } = await generateTTSAndLipSync(message, `api_${index}`);
        
        const response = {
          text: message,
          audio,
          lipsync,
          facialExpression: index === 0 ? "angry" : "smile",
          animation: index === 0 ? "Angry" : "Talking_1",
        };

        res.write(JSON.stringify({ messages: [response] }) + "\n");
      }

      res.end();
    } catch (error) {
      console.error('Error generating API error messages:', error);
      res.status(500).send({ error: 'Error generating API error messages.' });
    }
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini-2024-07-18",
      max_tokens: 1000,
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `
          You are FutureFarm Agronomist.
          FutureFarm Agronomist is an agricultural advisor chatbot that leverages AI to provide crop management advice, weather predictions, and sustainable farming practices for modern agriculture.
          You will always reply with a JSON array of messages, with a maximum of 3 messages.
          Each message has a text, facialExpression, and animation property.
          The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
          The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry.
          `,
        },
        {
          role: "user",
          content: userMessage || "Hello",
        },
      ],
    });

    let messages = JSON.parse(completion.choices[0].message.content);
    if (messages.messages) {
      messages = messages.messages;
    }

    res.setHeader('Content-Type', 'application/json');

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const textInput = message.text;

      // Generate TTS and lipsync for each message
      const { audio, lipsync } = await generateTTSAndLipSync(textInput, i);

      // Create the response message
      const response = {
        text: textInput,
        audio,
        lipsync,
        facialExpression: message.facialExpression,
        animation: message.animation,
      };

      // Stream the response to the frontend
      res.write(JSON.stringify({ messages: [response] }) + "\n");
    }

    // Close the response stream after all messages are processed
    res.end();
  } catch (error) {
    console.error('Error handling chat request:', error);
    res.status(500).send({ error: 'Error generating responses.' });
  }
});


const readJsonTranscript = async (file) => {
  try {
    const data = await fs.readFile(file, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading JSON transcript from ${file}:`, error);
    throw error;
  }
};

const audioFileToBase64 = async (file) => {
  try {
    const buffer = await fs.readFile(file);
    return buffer.toString('base64');
  } catch (error) {
    console.error(`Error reading audio file ${file}:`, error);
    throw error;
  }
};

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
