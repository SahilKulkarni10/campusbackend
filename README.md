# Campus Connect Backend API

This is the backend API for the Campus Connect application.

## Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.sample` to `.env` and fill in your configuration values
4. Start the development server:
   ```
   npm start
   ```

## Deployment to Render.com

### Environment Variables

When deploying to Render.com, make sure to set the following environment variables:

- `DATABASE_URL`: Your MongoDB connection string
- `JWT_SECRET_KEY`: Secret key for JWT token generation
- `CLIENT_URL_LOCAL`: http://localhost:5173
- `CLIENT_URL_PROD`: https://campusclient.vercel.app
- `PORT`: 8800 (or let Render set it automatically)

### CORS Configuration

The application is configured to accept requests from the frontend running at https://campusclient.vercel.app. If you deploy the frontend to a different URL, update the `CLIENT_URL_PROD` environment variable.

## API Endpoints

The API includes endpoints for:
- Authentication (/api/auth)
- Users (/api/users)
- Posts (/api/posts)
- Messages (/api/messages)
- Chats (/api/chats)
- Forums (/api/forums)

## Socket.IO

The backend includes Socket.IO for real-time communication. The socket server runs on the same port as the API. 