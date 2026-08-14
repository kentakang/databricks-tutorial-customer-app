import { createApp, analytics, server } from '@databricks/appkit';
import { agents } from '@databricks/appkit/beta';
import { support } from './agents/support';

process.env.NODE_ENV ??= 'production';

await createApp({
  plugins: [
    agents({
      dir: false,
      agents: { support },
      defaultAgent: 'support',
      limits: {
        maxConcurrentStreamsPerUser: 2,
        maxToolCalls: 8,
        maxSubAgentDepth: 1,
      },
    }),
    analytics(),
    server(),
  ],
  onPluginsReady(appkit) {
    appkit.server.extend((app) => {
      app.get('/api/whoami', (req, res) => {
        const forwardedUser = req.header('x-forwarded-user');
        res.json({
          displayName: forwardedUser || 'Local developer',
          executionMode: 'service-principal',
        });
      });
    });
  },
});
