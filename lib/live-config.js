'use strict';

var events = require('events');
var _ = require('lodash');
var util = require('util');
var Q = require("q");

var redis = require('./redis');

var CommandClient       = redis.CommandClient,
    SubscriptionsClient = redis.SubscriptionsClient;

var PUB_CHANNEL = (process.env.NODE_ENV === 'test') ? 'live-config:test' : 'live-config';

/**
 * Assigns redis client initialization attributes
 *
 * @constructor
 *
 * @param {Object} option
 * @param {string} [option.host]
 * @param {number} [option.port]
 * @param {string} [option.pass]
 */
function LiveConfig(option) {
  this._config            = {};
  this._commandClient     = null;
  this._subscriptionClient         = null;
  this._clientOptions     = option;
}

util.inherits(LiveConfig, events.EventEmitter);

/**
 * Start public and subscriptions clients
 * Init local config and merge it with the config from the Redis
 *
 * @param {object} config
 * @return {Promise}
 */
LiveConfig.prototype.start = function start(config) {
  var self = this;

  self.startCommandClient();
  self.startSubscriptionClient();

  self._config = config || {};

  self._commandClient.getConfig()
    .then(function (reply) {
      if (reply) {
        _.assign(config, reply);
      }

      self.emit('started', config);
    })
    .catch(function (err) {
      self.error(err);
    });
};

/**
 * Emit liveConfig error event
 *
 * @param {object} err
 */
LiveConfig.prototype.error = function error(err) {
  this.emit('error', err);
};

/**
 * Insert a value with a given key to the Redis.
 *
 * @param {string} key
 * @param {string} value
 * @return {Promise}
 */
LiveConfig.prototype.set = function set(key, value) {
  var deferred = Q.defer(),
      self = this;

  self._commandClient.set(key, value)
    .then(function (result) {
      self._config[key] = value;

      self._commandClient.publish(PUB_CHANNEL, { key: key, value: value });
      deferred.resolve(result);
    })
    .catch(function (err) {
      deferred.reject(err);
      self.error(err);
    });

  return deferred.promise;
};

/**
 * Get a value from the Redis by a given key.
 *
 * @param {string} key
 * @return {Promise}
 */
LiveConfig.prototype.get = function get(key) {
  var deferred = Q.defer(),
      self = this;

  self._commandClient.get(key)
    .then(function (value) {
      deferred.resolve(value);
    })
    .catch(function (err) {
      deferred.reject(err);
      self.error(err);
    });

  return deferred.promise;
};

/**
 * Start command redis client
 * @private
 */
LiveConfig.prototype.startCommandClient = function startCommandClient() {
  var self = this;

  self._commandClient = new CommandClient(this._clientOptions);

  self._commandClient.on('error', function(err) {
    self.error(err);
  });
};

/**
 * Start subscription redis client
 * @private
 */
LiveConfig.prototype.startSubscriptionClient = function startSubscriptionClient() {
  var self = this;

  self._subscriptionClient = new SubscriptionsClient(this._clientOptions);

  self._subscriptionClient.subscribe(PUB_CHANNEL);

  self._subscriptionClient.on('error', function (err) {
    self.error(err);
  });

  self._subscriptionClient.on('message', function (channel, message) {
    var config = {};

    if (channel === PUB_CHANNEL) {
      message = JSON.parse(message);

      if (message.key) {
        config[message.key] = message.value;
      }

      _.assign(self._config, config);
    }
  });
};

module.exports = LiveConfig;
