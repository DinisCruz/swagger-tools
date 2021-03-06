/* global describe, it */

/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Apigee Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

'use strict';

// Here to quiet down Connect logging errors
process.env.NODE_ENV = 'test';

var _ = require('lodash');
var assert = require('assert');
var helpers = require('../helpers');
var petJson = require('../../samples/1.2/pet.json');
var rlJson = require('../../samples/1.2/resource-listing.json');
var storeJson = require('../../samples/1.2/store.json');
var userJson = require('../../samples/1.2/user.json');
var request = require('supertest');

describe('Swagger Metadata Middleware v1.2', function () {
  it('should not add Swagger middleware to the request when there is no route match', function (done) {
    helpers.createServer([rlJson, [petJson, storeJson, userJson]], {
      handler: function (req, res, next) {
        if (req.swagger) {
          return next('This should not happen');
        }
        res.end('OK');
      }
    }, function (app) {
      request(app)
        .get('/foo')
        .expect(200)
        .end(helpers.expectContent('OK', done));
    });
  });

  it('should add Swagger middleware to the request when there is a route match and there are operations',
     function (done) {
       helpers.createServer([rlJson, [petJson, storeJson, userJson]], {
         handler: function (req, res, next) {
           var swagger = req.swagger;

           try {
             assert.ok(!_.isUndefined(swagger));
             assert.deepEqual(swagger.api, petJson.apis[0]);
             assert.deepEqual(swagger.apiDeclaration, petJson);
             assert.equal(swagger.apiIndex, 0);
             assert.deepEqual(swagger.authorizations, petJson.apis[0].authorizations || {});
             assert.deepEqual(swagger.operation, petJson.apis[0].operations[0]);
             assert.deepEqual(swagger.operationPath, ['apis', '0', 'operations', '0']);
             assert.deepEqual(swagger.params, {
               petId: {
                 path: ['apis', '0', 'operations', '0', 'parameters', '0'],
                 schema: petJson.apis[0].operations[0].parameters[0],
                 value: '1'
               }
             });
             assert.equal(swagger.resourceIndex, 0);
             assert.deepEqual(swagger.resourceListing, rlJson);
           } catch (err) {
             return next(err.message);
           }

           res.end('OK');
         }
       }, function (app) {
         request(app)
           .get('/api/pet/1')
           .expect(200)
           .end(helpers.expectContent('OK', done));
       });
  });

  describe('issues', function () {
    it('should handle non-lowercase header parameteters (Issue 82)', function (done) {
      var cPetJson = _.cloneDeep(petJson);

      // Add a header parameter
      cPetJson.apis[0].operations[0].parameters.push({
        description: 'Authentication token',
        name: 'Auth-Token',
        paramType: 'header',
        required: true,
        type: 'string'
      });

      helpers.createServer([rlJson, [cPetJson, storeJson, userJson]], {
        handler: function (req, res, next) {

          try {
            assert.deepEqual(req.swagger.params['Auth-Token'], {
              path: ['apis', '0', 'operations', '0', 'parameters', '1'],
              schema: cPetJson.apis[0].operations[0].parameters[1],
              value: 'fake'
            });
          } catch (err) {
            console.log(err);
            return next(err.message);
          }

          res.end('OK');
        }
      }, function (app) {
        request(app)
        .get('/api/pet/1')
        .set('Auth-Token', 'fake')
        .expect(200)
        .end(helpers.expectContent('OK', done));
      });
    });
  });
});
