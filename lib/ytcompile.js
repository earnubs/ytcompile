#!/usr/bin/env nodejs
'use strict';
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
 *  TODO build caching
 *
 */

var ArgumentParser = require('argparse').ArgumentParser,
    fs = require('fs'),
    path = require('path'),
    htmlparser = require('htmlparser'),
    Handlebars  = require('yui/handlebars').Handlebars,
    Micro = require('yui/template-micro').Template.Micro,

    FILE_EXTS = ['.hbs', '.mu', '.micro', '.handlebars'],
    DEFAULT_NAMESPACE = 'Templates',
    parser = new ArgumentParser({
        version: '0.0.1',
        addHelp: true,
        description: 'Precompile Y.Templates'
    }),
    args,
    src, dest, ns;

// --- setup command line options ----//
parser.addArgument(
    [ '-o', '--output-dir' ],
    {
        help: 'directory to write precompiled template files',
        required: true
    }
);
parser.addArgument(
    [ '-i', '--input-dir' ],
    {
        help: 'source template file directory',
        required: true
    }
);
parser.addArgument(
    [ '-n', '--namespace' ],
    {
        help: 'Namespace on Y to add the templates; default is Y.' + DEFAULT_NAMESPACE
    }
);




/**
 * write out the precompiled templates file
 *  @param {String} output
 *  @param {String} file the name of the file we're writing to, mirrors the
 *  name of the file templates read from
 */
function writeFile(output, file) {
    file = path.resolve(dest + '/' + path.basename(file));
    fs.writeFile(file + '.js', output, function(err) {
        if(err) {
            console.log('Uh, oh...');
            console.log(err);
        } else {
            console.log("Templates precompiled to: " + file + ".js");
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
 * Is this a valid Directory, if not bail out
 * @param {String} path
 * @return {Boolean}
 */
function isDirectory(dir) {
    try {
        var stat = fs.statSync(dir);
        if (stat.isDirectory()) {
            return path.normalize(dir);
        } else {
            console.error('Error: "' + dir + '" is not a directory.');
            process.exit();
        }
    } catch (e) {
        console.error('Error: "' + e.dir + '" is not a directory.');
        process.exit();
    }
}

args = parser.parseArgs(process.argv.slice(2));

src = isDirectory(args.input_dir);
dest = isDirectory(args.output_dir);
ns = args.namespace || DEFAULT_NAMESPACE;


var templates = fs.readdirSync(src).filter(function(file) {
    var ext = path.extname(file), isMatch = false;
    FILE_EXTS.forEach(function(x) {
        if (x == ext) {
            isMatch = true;
        }
    });
    return isMatch;
})

templates.forEach(function(file) {
        file = path.resolve(src + '/' + file);
        fs.stat(file, function(err, stats) {
            if (stats.isFile()) {
                fs.readFile(file, 'utf8', function (err, data) {
                    if (err) { throw err; }
                    parseHTML(data, getExtension(file), file);
                });
            }
        });
});
