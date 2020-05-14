module.exports = function (app, express) {
    var ERR = {
        '300': 'MULTIPLE CHOICES:The requested resource corresponds to any one of a set of representations, each with its own specific location.',
        '301': 'MOVED PERMANENTLY:The resource has moved permanently. Please refer to the documentation.',
        '302': 'FOUND:The resource has moved temporarily. Please refer to the documentation.',
        '303': 'SEE OTHER:The resource can be found under a different URI.',
        '304': 'NOT MODIFIED:The resource is available and not modified.',
        '305': 'USE PROXY:The requested resource must be accessed through the proxy given by the Location field.',
        '307': 'TEMPORARY REDIRECT:The resource resides temporarily under a different URI.',
        '400': 'BAD REQUEST:Invalid syntax for this request was provided.',
        '401': 'UNAUTHORIZED:You are unauthorized to access the requested resource. Please log in.',
        '403': 'FORBIDDEN:Your account is not authorized to access the requested resource.',
        '404': 'NOT FOUND:We could not find the resource you requested. Please refer to the documentation for the list of resources.',
        '405': 'METHOD NOT ALLOWED:This method type is not currently supported.',
        '406': 'NOT ACCEPTABLE:Acceptance header is invalid for this endpoint resource.',
        '407': 'PROXY AUTHENTICATION REQUIRED:Authentication with proxy is required.',
        '408': 'REQUEST TIMEOUT:Client did not produce a request within the time that the server was prepared to wait.',
        '409': 'CONFLICT:The request could not be completed due to a conflict with the current state of the resource.',
        '410': 'GONE:The requested resource is no longer available and has been permanently removed.',
        '411': 'LENGTH REQUIRED:Length of the content is required, please include it with the request.',
        '412': 'PRECONDITION FAILED:The request did not match the pre-conditions of the requested resource.',
        '413': 'REQUEST ENTITY TOO LARGE:The request entity is larger than the server is willing or able to process.',
        '414': 'REQUEST-URI TOO LONG:The request URI is longer than the server is willing to interpret.',
        '415': 'UNSUPPORTED MEDIA TYPE:The requested resource does not support the media type provided.',
        '416': 'REQUESTED RANGE NOT SATISFIABLE:The requested range for the resource is not available.',
        '417': 'EXPECTATION FAILED:Unable to meet the expectation given in the Expect request header.',
        '419': 'MISSING ARGUMENTS:The requested resource is missing required arguments.',
        '420': 'INVALID ARGUMENTS:The requested resource does not support one or more of the given parameters.',
        '422': 'UNPROCESSABLE ENTITY:The request was well-formed but was unable to be followed due to semantic errors.',
        '500': 'INTERNAL SERVER ERROR:Unexpected internal server error.',
        '501': 'NOT IMPLEMENTED:The requested resource is recognized but not implemented.',
        '502': 'BAD GATEWAY:Invalid response received when acting as a proxy or gateway.',
        '503': 'SERVICE UNAVAILABLE:The server is currently unavailable.',
        '504': 'GATEWAY TIMEOUT:Did not receive a timely response from upstream server while acting as a gateway or proxy.',
        '505': 'HTTP VERSION NOT SUPPORTED:The HTTP protocol version used in the request message is not supported.',
        '550': 'INITIALIZATION FAILURE:A failure occurred during initialization of services. API will be unavailable.'
    };
    var html = [
        '<html>',
        '<head>',
        '<title>Error: {num}</title>',
        '<link rel="stylesheet" type=text/css href="/errors/assets/index.css">',
        '</head>',

        '<body>',
        '<div class="noise"></div>',
        '<div class="overlay"></div>',
        '<div class="terminal">',
        '<h1>Error <span class="errorcode">{num}</span></h1>',
        '<p class="output">{text}</p>',
        '<p class="output">{err}</p>',
        '<p class="output">Please try to <a href="javascript:history.back()">go back</a> or <a href="/">return to the homepage</a>.</p>',
        '<p class="output">Good luck.</p>',
        '</div>',
        '</body>',
        '</html>'
    ];

    app.use('/errors/assets', express.static(__dirname + '/errors'));

    // Handle 404
    app.use(function (req, res) {
        var ndx = 404;
        if (!ERR[ndx]) return res.end('ERR');
        var h = html.join('');
        h = h.replace(/{num}/g, ndx);
        h = h.replace('{text}', ERR[ndx].replace(':', '<br><br>'));
        h = h.replace('{err}', '');
        res.set('Content-Type', 'text/html');
        res.end(h);
    });

    // Handle 500
    app.use(function (error, req, res, next) {
        var ndx = 500;
        if (!ERR[ndx]) return res.end('ERR');
        var h = html.join('');
        h = h.replace(/{num}/g, ndx);
        h = h.replace('{text}', ERR[ndx].replace(':', '<br><br>'));
        h = h.replace('{err}', error);
        res.set('Content-Type', 'text/html');
        res.end(h);
    });

}