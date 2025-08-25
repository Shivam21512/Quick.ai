import { clerkClient } from "@clerk/express";
import OpenAI from "openai";
import sql from "../configs/db.js";
import axios from "axios";
import {v2 as cloudinary} from 'cloudinary'

const AI = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

export const generateArticle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, length } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    // Free plan usage limit
    if (plan !== "premium" && free_usage >= 10) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue."
      });
    }

    // Generate AI response
    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: length
    });

    const content =
      response.choices?.[0]?.message?.content?.trim() || null;

    if (!content) {
      return res.json({
        success: false,
        message: "AI did not return any content"
      });
    }

    // Save to DB
    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, ${prompt}, ${content}, 'article')
    `;

    // Update free usage if not premium
    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1
        }
      });
    }

    res.json({
      success: true,
      content
    });
  } catch (error) {
    console.error("Error generating article:", error.message);
    res.json({
      success: false,
      message: error.message
    });
  }
};

export const generateBlogTitle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    // Free plan usage limit
    if (plan !== "premium" && free_usage >= 10) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue."
      });
    }

    // Generate AI response
    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 100
    });

    const content =
      response.choices?.[0]?.message?.content?.trim() || null;

    if (!content) {
      return res.json({
        success: false,
        message: "AI did not return any content"
      });
    }

    // Save to DB
    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, ${prompt}, ${content}, 'blog-title')
    `;

    // Update free usage if not premium
    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1
        }
      });
    }

    res.json({
      success: true,
      content
    });
  } catch (error) {
    console.error("Error generating blog-title:", error.message);
    res.json({
      success: false,
      message: error.message
    });
  }
};

export const generateImage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, publish } = req.body;
    const plan = req.plan;

    // Free plan usage limit
    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions."
      });
    }

    // Generate AI response
    const formData = new FormData()
    formData.append('prompt', prompt)
    const {data} = await axios.post("https://clipdrop-api.co/text-to-image/v1", formData, {
        headers: {'x-api-key': process.env.CLIPDROP_API_KEY,},
        responseType: "arraybuffer",
    })

    const base64Image = `data:image/png;base64,${Buffer.from(data, 'binary').toString('base64')}`;

    const {secure_url} = await cloudinary.uploader.upload(base64Image)

    // Save to DB
    await sql`
      INSERT INTO creations (user_id, prompt, content, type, publish)
      VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})
    `;

    res.json({
      success: true,
      content: secure_url
    });
  } catch (error) {
    console.error("Error generating image:", error.message);
    res.json({
      success: false,
      message: error.message
    });
  }
};

