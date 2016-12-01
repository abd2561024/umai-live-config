'use strict';

var events = require("events");
var redis = require("redis");
var _ = require('lodash');
var util = require("util");
var Q = require("q");

var KEY = (process.env.NODE_ENV === 'test') ? 'live-config:test' : 'live-config';

/**
 * Basic Redis client
 *
 * @constructor
 *
 * @param {object} opt
 * @param {string} [opt.host]
 * @param {number} [opt.port]
 * @param {string} [opt.pass]
 */
function BaseRedisClient(opt) {
  this.client = redis.createClient(opt.port, opt.host, { 'auth_pass': opt.pass });

  this.client.on('error', function (err) {
    this.emit('error', err)
  });
}

util.inherits(BaseRedisClient, events.EventEmitter);

/**
 * Command Redis client
 *
 * @constructor
 *
 * @param {object} opt
 * @param {string} [opt.host]
 * @param {number} [opt.port]
 * @param {string} [opt.pass]
 */
function CommandClient(opt) {
  BaseRedisClient.call(this, opt);
}

CommandClient.prototype = Object.create(BaseRedisClient.prototype);

/**
 * Insert a value to the Redis.
 *
 * @param {string} key
 * @param {string} value
 * @return {Promise}
 */
CommandClient.prototype.set = function set(key, value) {
  var deferred = Q.defer(),
      self = this;

  self.client.hset(KEY, key, value, function (err) {
    if(err) deferred.reject(err);

    deferred.resolve({ key: key, value: value });
  });

  return deferred.promise;
};

/**
 * Get a value from the Redis by a given key.
 *
 * @param {string} key
 * @return {Promise}
 */
CommandClient.prototype.get = function get(key) {
  var deferred = Q.defer(),
      self = this;

  self.client.hget(KEY, key, function (err, value) {
    if(err) deferred.reject(err);


    deferred.resolve(value ? { key: key, value: value } : null);
  });

  return deferred.promise;
};

/**
 * Get a liveConfig hashMap from the Redis.
 *
 * @return {Promise}
 */
CommandClient.prototype.getConfig = function getConfig() {
  var deferred = Q.defer();

  this.client.hgetall(KEY, function (err, entry) {
    if(err) deferred.reject(err);

    deferred.resolve(entry || null);
  });

  return deferred.promise;
};

/**
 * Post a message to the given channel.
 *
 * @param {string} channel
 * @param {object} message
 * @return {Promise}
 */
CommandClient.prototype.publish = function publish(channel, message) {
  var deferred = Q.defer(),
      self = this;

  self.client.publish(channel, JSON.stringify(message), function (err) {
    if(err) deferred.reject(err);

    deferred.resolve();
  });

  return deferred.promise;
};

/**
 * Subscription Redis client
 *
 * @constructor
 *
 * @param {object} opt
 * @param {string} [opt.host]
 * @param {number} [opt.port]
 * @param {string} [opt.pass]
 */
function SubscriptionsClient(opt) {
  BaseRedisClient.call(this, opt);

  var self = this;

  self.client.on('message', function(channel, message) {
    self.emit('message', channel, message);
  });
}

SubscriptionsClient.prototype = Object.create(BaseRedisClient.prototype);

/**
 * Subscribe client to the specified channel.
 *
 * @param {string} channel
 * @return {Promise}
 */
SubscriptionsClient.prototype.subscribe = function subscribe(channel) {
  this.client.subscribe(channel);
};

module.exports = {
  CommandClient: CommandClient,
  SubscriptionsClient: SubscriptionsClient
};
