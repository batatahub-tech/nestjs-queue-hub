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
        <li><a href="/api/notification">Notification Queue</a></li>
        <li><a href="/api/job-opts-demo">JobOpts Demo (NEW!)</a></li>
      </ul>
      <h2>JobOpts Demo Endpoints:</h2>
      <ul>
        <li>POST /api/job-opts-demo/test-delay - Test delay option</li>
        <li>POST /api/job-opts-demo/test-priority - Test priority sorting</li>
        <li>POST /api/job-opts-demo/test-attempts - Test retry attempts</li>
        <li>POST /api/job-opts-demo/test-timeout - Test job timeout</li>
        <li>POST /api/job-opts-demo/test-backoff - Test backoff strategies</li>
        <li>POST /api/job-opts-demo/test-remove-on-complete - Test removeOnComplete</li>
        <li>POST /api/job-opts-demo/test-remove-on-fail - Test removeOnFail</li>
        <li>POST /api/job-opts-demo/test-job-id - Test custom jobId</li>
        <li>POST /api/job-opts-demo/test-lifo - Test LIFO ordering</li>
        <li>POST /api/job-opts-demo/test-complex - Test all options together</li>
        <li>GET /api/job-opts-demo/job/:jobId - Get job status</li>
        <li>GET /api/job-opts-demo/stats - Get queue statistics</li>
      </ul>
      <h2>Other Examples:</h2>
      <ul>
        <li>POST /api/audio/process - Process audio file</li>
        <li>POST /api/notification/send - Send notification</li>
      </ul>
    `;
  }
}
