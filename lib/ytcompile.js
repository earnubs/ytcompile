#!/usr/bin/env nodejs
/*
 * ytcompile
 * https://github.com/earnubs/ytcompile
 *
 * Copyright (c) 2013 Stephen Stewart
 * Licensed under the MIT license.
 */


/**
 * Take template files and build out their equivalents as precompiled template
 * functions, ready to be squished and packaged by shifter or whatever.
 *
 * Template files contain a <script> node per template, eg.
 * <script id=foo type=x-template>
 *  Hello {{planet}}!
 * </script>
 *
 * The template file extension should be one of handlebars|hbs, micro|mu which
 * will determine which compilation step we take
 *
 * In the template file, each <script> nodes id attribute will be used to set
 * the namespace on Y.U1.Template for that template
 *
 * ./precompile -d /path/to/output file1 file2 file3
 *
 * -d output directory, optional, defaults to ./js/templates/ (add this path to
 *  your build.json for shifter to pick up)
 *
 */

var fs = require('fs'),
    path = require('path'),
    htmlparser = require('htmlparser'),
    Handlebars  = require('yui/handlebars').Handlebars,
    Micro = require('yui/template-micro').Template.Micro,

    BUILD_DIR_REGEX = new RegExp(/^(?:-d|--dest)=(.*)$/),
    DEFAULT_BUILD_DIR = './js/templates/';

/**
 * write the file
 *  @param {String} output
 *  @param {String} file the name of the file we're writing to, mirrors the
 *  name of the file templates read from
 */
function writeFile(output, file) {
    fs.writeFile(dest + file + '.js', output, function(err) {
        if(err) {
            console.log('Uh, oh...');
            console.log(err);
        } else {
            console.log("Templates precompiled to: " + dest + file + ".js");
        }
    });
}

/**
 * handle the parsed dom
 * @param {Object} dom
 * @param {String} type Y.Template.Micro or Y.Template.Handlebars
 */
function parsedFileDomHandler( dom, type ) {
        var i, l, node, html, namespace,
        output = 'var tmpl = {};\n';

        for (i = 0, l = dom.length; i < l; i++ ) {
            node = dom[i];
            if ( node.type === 'script' ) {
                if (
                    ( node.attribs.type === 'x-template' ||
                      node.attribs.type === 'text/x-handlebars-template' ) &&
                    node.children &&
                    node.children[0].type === 'text'
                ) {
                    html = node.children[0].raw;
                    namespace = node.attribs.id;

                    output += 'tmpl["' + namespace + '"] = ';

                    if (type && (type === 'hbs' || type === 'handlebars')) {
                        output += Handlebars.precompile(html);
                    }

                    if (type && (type === 'mu' || type === 'micro')) {
                        output += Micro.precompile(html);
                    }

                    output += '\n\n';

                } else {
                    console.log('<script> element empty or has irrelevant type attribute, skipping');
                }
            }
        }

        output += 'Y.namespace("U1.Templates");\n';
        output += 'Y.U1.Templates = tmpl;\n';

        return output;
}

/**
 * parse the file as html
 * @param {String} html the file contents
 * @param {String} ext file extension, decides if the precompiler to use
 * @param {String} filename so we can write a new file in $dest of the sam name
 **/

function parseHTML(html, ext, filename) {

    var handler = new htmlparser.DefaultHandler(function(err, dom) {

        if (err) {
            throw err;
        }

        // write output to file
        writeFile(parsedFileDomHandler(dom, ext), filename);
    });

    parser = new htmlparser.Parser(handler);

    parser.parseComplete(html);


}

function getExtension(filename) {
    var ext = path.extname(filename||'').split('.');
    return ext[ext.length - 1];
}

/**
 * Do stuff with CLI arguments
 * @param {String} val the argument
 * @param {Number} index position of option in arguments array
 */
function handleCliOptions(val, index) {
    dest = val.match(BUILD_DIR_REGEX);

    //replace the default destination
    if (dest) {
        dest = path.normalize(dest[1]);
    } else {
        dest = DEFAULT_BUILD_DIR;
    }

    // not an option, must be a filename, right?
    if (index > 1 && val.charAt(0) !== '-') {
        fs.exists(val, function (exists) {
            if (exists) {
                fs.stat(val, function(err, stats) {
                    if (stats.isFile()) {
                        var ext = getExtension(val),
                        fn = path.basename(val);

                        fs.readFile(val, 'utf8', function (err, data) {
                            if (err) { throw err; }
                            parseHTML(data, ext, fn);
                        });
                    }
                    // TODO
                    if (stats.isDirectory()) {
                        console.log('TODO: handle directory');
                    }
                });

            } else {
                console.log(val + ': file not found');
            }
        });
    }
}

// do it!
process.argv.forEach(handleCliOptions);
