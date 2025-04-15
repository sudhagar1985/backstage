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

import { RootConfigService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { InputError } from '@backstage/errors';
import { Message } from '@google-cloud/pubsub';
import { SubscriptionTask } from './types';

export function readSubscriptionTasksFromConfig(
  rootConfig: RootConfigService,
): SubscriptionTask[] {
  const subscriptionsConfig = rootConfig.getOptionalConfig(
    'events.modules.googlePubSub.googlePubSubConsumingEventPublisher.subscriptions',
  );
  if (!subscriptionsConfig) {
    return [];
  }

  return subscriptionsConfig.keys().map(subscriptionId => {
    if (!subscriptionId.match(/^[-_\w]+$/)) {
      throw new InputError(
        `Expected Googoe Pub/Sub subscription ID to consist of letters, numbers, dashes and lodashes, but got '${subscriptionId}'`,
      );
    }

    const config = subscriptionsConfig.getConfig(subscriptionId);
    const { project, subscription } = readSubscriptionName(config);
    const mapToTopic = readTopicMapper(config);

    return {
      id: subscriptionId,
      project,
      subscription,
      mapToTopic,
    };
  });
}

function readSubscriptionName(config: Config): {
  project: string;
  subscription: string;
} {
  const subscriptionName = config.getString('subscriptionName');
  const parts = subscriptionName.match(
    /^projects\/([^/]+)\/subscriptions\/(.+)$/,
  );
  if (!parts) {
    throw new InputError(
      `Expected Googoe Pub/Sub 'subscriptionName' to be on the form 'projects/PROJECT_ID/subscriptions/SUBSCRIPTION_ID' but got '${subscriptionName}'`,
    );
  }
  return {
    project: parts[1],
    subscription: parts[2],
  };
}

function readTopicMapper(
  config: Config,
): (message: Message) => string | undefined {
  const stringOrObject = config.get('targetTopic');
  if (typeof stringOrObject === 'string') {
    return () => stringOrObject;
  }

  const fromMessageAttribute = config.getOptionalConfig(
    'targetTopic.fromMessageAttribute',
  );
  if (fromMessageAttribute) {
    const attributeName = fromMessageAttribute.getString('attributeName');
    const withPrefix = fromMessageAttribute.getOptionalString('withPrefix');
    return (message: Message) => {
      const topic = message.attributes?.[attributeName];
      if (!topic || typeof topic !== 'string') {
        return undefined;
      }
      return withPrefix ? `${withPrefix}${topic}` : topic;
    };
  }

  throw new InputError(
    `Expected Googoe Pub/Sub 'targetTopic' to be either a string or an object with 'fromMessageAttribute' but got '${JSON.stringify(
      stringOrObject,
    )}'`,
  );
}
