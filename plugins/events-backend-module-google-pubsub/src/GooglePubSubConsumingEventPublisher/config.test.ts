/*
 * Copyright 2025 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { mockServices } from '@backstage/backend-test-utils';
import { JsonObject } from '@backstage/types';
import { Message } from '@google-cloud/pubsub';
import { readSubscriptionTasksFromConfig } from './config';

function makeMessage(
  data: JsonObject,
  attributes: Record<string, string>,
): Message {
  const message: Partial<Message> = {
    attributes,
    data: Buffer.from(JSON.stringify(data), 'utf-8'),
    ack: jest.fn(),
    nack: jest.fn(),
  };
  return message as Message;
}

describe('readSubscriptionTasksFromConfig', () => {
  it('reads with basic targetTopic', () => {
    const data = {
      events: {
        modules: {
          googlePubSub: {
            googlePubSubConsumingEventPublisher: {
              subscriptions: {
                subKey: {
                  subscriptionName: 'projects/pid/subscriptions/sid',
                  targetTopic: 'my-topic',
                },
              },
            },
          },
        },
      },
    };

    const result = readSubscriptionTasksFromConfig(
      mockServices.rootConfig({ data }),
    );

    expect(result).toEqual([
      {
        id: 'subKey',
        project: 'pid',
        subscription: 'sid',
        mapToTopic: expect.any(Function),
      },
    ]);

    expect(result[0].mapToTopic(makeMessage({ foo: 'bar' }, {}))).toBe(
      'my-topic',
    );
  });

  it('reads with fromMessageAttribute', () => {
    const data = {
      events: {
        modules: {
          googlePubSub: {
            googlePubSubConsumingEventPublisher: {
              subscriptions: {
                subKey: {
                  subscriptionName: 'projects/pid/subscriptions/sid',
                  targetTopic: {
                    fromMessageAttribute: {
                      attributeName: 'event',
                      withPrefix: 'github.',
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = readSubscriptionTasksFromConfig(
      mockServices.rootConfig({ data }),
    );

    expect(result).toEqual([
      {
        id: 'subKey',
        project: 'pid',
        subscription: 'sid',
        mapToTopic: expect.any(Function),
      },
    ]);

    expect(
      result[0].mapToTopic(makeMessage({ foo: 'bar' }, { event: 'push' })),
    ).toBe('github.push');
    expect(result[0].mapToTopic(makeMessage({ foo: 'bar' }, {}))).toBe(
      undefined,
    );
  });

  it('rejects malformed subscription name', () => {
    const data = {
      events: {
        modules: {
          googlePubSub: {
            googlePubSubConsumingEventPublisher: {
              subscriptions: {
                subKey: {
                  subscriptionName: 'sid',
                  targetTopic: {
                    fromMessageAttribute: {
                      attributeName: 'event',
                      withPrefix: 'github.',
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    expect(() =>
      readSubscriptionTasksFromConfig(mockServices.rootConfig({ data })),
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expected Googoe Pub/Sub 'subscriptionName' to be on the form 'projects/PROJECT_ID/subscriptions/SUBSCRIPTION_ID' but got 'sid'"`,
    );
  });
});
