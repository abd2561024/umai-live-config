'use strict';

var expect = require('chai').expect;
var ConfigLive = require('./lib/live-config');
var redis = require('redis');

var connectionOptions = {  host: 'localhost', port: 6379 },
    redisClient = redis.createClient(connectionOptions.port, connectionOptions.host);

var KEY = 'live-config:test';

describe('live-config', function () {
  var params, configLive, config = {};

  beforeEach('create configLive', function () {
    configLive = new ConfigLive(connectionOptions);
  });

  beforeEach('clear Redis', function (done) {
    redisClient.unref();
    redisClient.flushdb(done);
  });

  describe('requiring', function () {
    it('should not throw an error', function () {
      expect(function () {
        return require('./lib/live-config');
      }).to.not.throw();
    });
  });

  describe('.start', function () {
    beforeEach('setup config', function () {
      config = {
        db: {
          testPort: 8998,
          testHost: 'http://some-host.com'
        },
        connectAttempt: 5
      };
    });

    it('should emits \'ready\' when started', function (done) {
      configLive.on('error', function (err) {
        return done(err);
      });

      configLive.once('ready', function (message) {
        try {
          expect(message).to.be.eql(config);
        }
        catch(e) {
          return done();
        }

        done();
      });

      configLive.start(config);
    });

    it('should merge a new config with the exists', function (done) {
      redisClient.hset(KEY, 'init-config', 'init-value', function (err) {
        if (err) {
          return done(err);
        }

        configLive.once('error', function (err) {
          done(err);
        });

        configLive.once('ready', function (message) {
          try {
            expect(message).to.be.eql({
              db: {
                testPort: 8998,
                testHost: 'http://some-host.com'
              },
              connectAttempt: 5,
              'init-config': 'init-value'
            });
          }
          catch(e) {
            return done(e);
          }

          done();
        });

        configLive.start(config);
      });
    });

    it('should subscribes and live-updates the given config', function (done) {
      var pub = redis.createClient(),
        message = {
          key: 'db-connect-attempt',
          value: 2
        };

      configLive.start(config);

      configLive.once('ready', function () {
        try {
          redisClient.hset(KEY, message.key, message.value, function (err) {
            if (err) {
              return done(err);
            }

            pub.publish(KEY, JSON.stringify(message));

            // timeout for `redis.publish`
            setTimeout(function () {
              expect(config).to.have.property('db-connect-attempt', 2);

              done();
            }, 10);
          });
        }
        catch (e) {
          return done(e);
        }
      });
    });

    it('should not assign default config value if there is entry with the same keys in redis',
      function (done) {
        redisClient.hset(KEY, 'connectAttempt', 0, function (err) {
          if (err) {
            return done(err);
          }
          configLive.once('error', function (err) {
            done(err);
          });

          configLive.once('ready', function () {
            try {
              expect(config).to.have.property('connectAttempt', '0');
            }
            catch (e) {
              return done(e);
            }

            done();
          });

          configLive.start(config);
        });
      });
  });

  describe('.set', function () {
    beforeEach('init configLive', function () {
      configLive.start(config);
    });

    beforeEach('setup params', function () {
      params = { key: 'host', value: 'http://some-host' };
    });

    it('should updates the redis value', function (done) {
      configLive.set(params.key, params.value)
        .then(function () {
          try {
            redisClient.hget(KEY, 'host', function (err, value) {
              if (err) {
                return done(err);
              }

              expect(value).to.eql('http://some-host');

              done();
            });
          }
          catch (e) {
            return done(e);
          }
        })
        .catch(function (err) {
          done(err);
        });
    });

    it('should updates the given config', function (done) {
      configLive.set(params.key, params.value)
        .then(function () {
          try {
            expect(config).to.have.property('host', 'http://some-host');

            done();
          }
          catch (e) {
            return done(e);
          }
        })
        .catch(function (err) {
          done(err);
        });
    });
  });

  describe('.get', function () {
    beforeEach('setup config', function () {
      params = { key: 'port', value: 5885 };
    });

    beforeEach('init configLive', function () {
      configLive.start();
    });

    it('should resoles value from the redis with the given `key`', function (done) {
      redisClient.hset(KEY, params.key, params.value, function (err) {
        if (err) {
          return done(err);
        }

        configLive.once('ready', function () {
          configLive.get('port')
            .then(function (result) {
              try {
                expect(result).to.have.property('key', 'port');
                expect(result).to.have.property('value', '5885');

                done();
              }
              catch (e) {
                return done(e);
              }
            })
            .catch(function (err) {
              done(err);
            });
        });
      });
    });

    it('should resoles `null` if there is no entry with given `key`', function (done) {
      redisClient.hset(KEY, params.key, params.value, function (err) {
        if (err) {
          return done(err);
        }

        configLive.once('ready', function () {
          configLive.get('invalid-key')
            .then(function (result) {
              try {
                expect(result).to.be.null;

                done();
              }
              catch (e) {
                return done(e);
              }
            })
            .catch(function (err) {
              done(err);
            });
        });
      });
    });
  });
});
