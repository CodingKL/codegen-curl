var expect = require('chai').expect,
    sdk = require('postman-collection'),
    exec = require('shelljs').exec,
    newman = require('newman'),
    parallel = require('async').parallel,

    convert = require('../../index').convert,
    mainCollection = require('./fixtures/testcollection/collection.json');

/**
 * runs codesnippet then compare it with newman output
 *
 * @param {String} codeSnippet - code snippet that needed to run using java
 * @param {Object} collection - collection which will be run using newman
 * @param {Function} done - callback for async calls
 */
function runSnippet (codeSnippet, collection, done) {

    //  step by step process for compile, run code snippet, then comparing its output with newman
    parallel([
        function (callback) {
            return exec(codeSnippet, function (err, stdout, stderr) {
                if (err) {
                    return callback(err);
                }
                if (stderr) {
                    return callback(stderr);
                }
                try {
                    stdout = JSON.parse(stdout);
                }
                catch (e) {
                    console.error(e);
                }
                return callback(null, stdout);
            });
        },
        function (callback) {
            newman.run({
                collection: collection
            }).on('request', function (err, summary) {
                if (err) {
                    return callback(err);
                }

                var stdout = summary.response.stream.toString();
                if (summary.request.method === 'HEAD') {
                    stdout = summary.response.code.toString();
                    return callback(null, stdout);
                }
                try {
                    stdout = JSON.parse(stdout);
                }
                catch (e) {
                    console.error(e);
                }
                return callback(null, stdout);
            });
        }
    ], function (err, result) {
        if (err) {
            expect.fail(null, null, err);
        }
        else if (typeof result[1] !== 'object' || typeof result[0] !== 'object') {
            expect(result[0].trim()).to.include(result[1].trim());
        }
        else {
            const propertiesTodelete = ['cookies', 'headersSize', 'startedDateTime', 'clientIPAddress'],
                headersTodelete = [
                    'accept-encoding',
                    'user-agent',
                    'cf-ray',
                    'x-real-ip',
                    'x-request-id',
                    'kong-request-id',
                    'x-request-start',
                    'connect-time',
                    'x-forwarded-for',
                    'content-type',
                    'content-length',
                    'accept',
                    'total-route-time',
                    'cookie'
                ];
            if (result[0]) {
                propertiesTodelete.forEach(function (property) {
                    delete result[0][property];
                });
                if (result[0].headers) {
                    headersTodelete.forEach(function (property) {
                        delete result[0].headers[property];
                    });
                }
            }
            if (result[1]) {
                propertiesTodelete.forEach(function (property) {
                    delete result[1][property];
                });
                if (result[1].headers) {
                    headersTodelete.forEach(function (property) {
                        delete result[1].headers[property];
                    });
                }
            }

            expect(result[0]).deep.equal(result[1]);
        }
        return done();
    });
}

describe('curl convert function', function () {
    describe('convert for different request types', function () {

        mainCollection.item.forEach(function (item) {
            it(item.name, function (done) {
                var request = new sdk.Request(item.request),
                    collection = {
                        item: [
                            {
                                request: request.toJSON()
                            }
                        ]
                    },
                    options = {
                        indentCount: 3,
                        indentType: 'space',
                        requestTimeout: 200,
                        multiLine: true,
                        followRedirect: true,
                        longFormat: true,
                        testMode: true
                    };
                convert(request, options, function (error, snippet) {
                    if (error) {
                        expect.fail(null, null, error);
                        return;
                    }
                    runSnippet(snippet, collection, done);
                });
            });
        });
    });
});
