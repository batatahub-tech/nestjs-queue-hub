import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return `
      <h1>🐂 QueueHub Demo Application</h1>
      <p>Welcome to the @batatahub.com/nestjs-queue-hub demo!</p>
      <h2>Available Endpoints:</h2>
      <ul>
        <li><a href="/api/audio">Audio Processing Queue</a></li>
        <li><a href="/api/email">Email Queue</a></li>
        <li><a href="/api/notification">Notification Queue</a></li>
      </ul>
      <h2>Examples:</h2>
      <ul>
        <li>POST /api/audio/process - Process audio file</li>
        <li>POST /api/email/send - Send email</li>
        <li>POST /api/notification/send - Send notification</li>
      </ul>
    `;
  }
}
