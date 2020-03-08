import fs from 'fs';
import {join, relative, basename, extname} from 'path';
import glob from 'glob';
import rimraf from 'rimraf';
import gitPromise from 'simple-git/promise';

(async () => {

    let namespaces = [];

    let cacheDir = './cache';
    if(fs.existsSync(cacheDir)) {
        rimraf.sync(cacheDir);
    }
    fs.mkdirSync(cacheDir);

    let buildDir = join(cacheDir, 'dist');
    fs.mkdirSync(buildDir);

    function add(namespace, data) {
        if(namespaces.includes(namespace)) {
            throw new Error(`Duplicate namespace: ${namespace}`);
        }
        namespaces.push(namespace);
        fs.writeFileSync(join(buildDir, namespace + '.want'), data);
    }

    function addFromDirectory(dir, namespace = basename(dir), fullNames = false) {
        let names = [];
        let parts = glob.sync(join(dir, '**/*.{txt,want}'))
            .map(file => {
                let name = (fullNames ? relative(dir, file).replace(/[/\\]/, '_') : basename(file)).slice(0, -extname(file).length);
                if(names.includes(name)) {
                    throw new Error(`Duplicate key: ${namespace}:${name}`);
                }
                names.push(name);

                let data = fs.readFileSync(file).toString('utf8');
                return `{> ${name}}\n${data.trim()}`;
            });
        add(namespace, `{> ${namespace}:}\n\n${parts.join('\n\n')}`);
    }

    function addFromSubdirectories(dir, getNamespace = s => s, fullNames = false) {
        fs.readdirSync(dir).forEach(name => {
            let sub = join(dir, name);
            if(fs.lstatSync(sub).isDirectory()) {
                addFromDirectory(sub, getNamespace(name), fullNames);
            }
        });
    }

    // default
    addFromSubdirectories('./words');

    // imsky/wordlists
    let git = gitPromise(cacheDir);
    let dir = join(cacheDir, 'imsky');
    await git.clone('https://github.com/imsky/wordlists', 'imsky');
    rimraf.sync(join(dir, '.git'));
    addFromSubdirectories(dir, s => 'imsky_' + s, true);

    fs.writeFileSync(join(buildDir, '_namespaces.txt'), namespaces.join('\n'));

})().catch(err => {
    console.error(err.stack || err);
    process.exit(1);
});


