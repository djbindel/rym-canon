const cheerio = require('cheerio');
const fs = require('fs');
const util = require('util');
// const mongoose = require('mongoose');
const type = process.argv.slice(2)[0];

// mongoose.connect('mongodb://localhost:27017', {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
// });

// const db = mongoose.connection;

const readFileAsync = util.promisify(fs.readFile);

async function getGenres(file, type) {
    let symbol;
    if (type === 'Album') symbol = 'l';
    if (type === 'Film') symbol = 'F';

    const html = await readFileAsync(`./voting/${file}.html`);
    const $ = cheerio.load(html);
    const url = $(`a.${type.toLowerCase()}`).attr('href');
    const release = /([^/]*)\/$/.exec(url)[1];
    const trackNumber = $('ul.trackselector').children('li.selected').index();
    const releaseId = /(\d+)/.exec($(`a.${type.toLowerCase()}`).attr('title'))[1];

    const primary = {
        class: 'Primary',
        domId: `genreList${symbol}g`
    };
    const secondary = {
        class: 'Secondary',
        domId: `genreList${symbol}s`
    };

    let genreEntries = [];
    function scrapeVotingEntries(level) {
        $(`#${level.domId}${releaseId}`).children().each(function (i, element) {
            const upvotes = Number(/voted for: \((\d+)\)/.exec($(this).text())[1]);
            const downvotes = Number(/voted against: \((\d+)\)/.exec($(this).text())[1]);
            const voteBalance = upvotes - downvotes;
            
            const genreEntry = {
                level: level.class,
                genre: $(this).find('a[title]').text(),
                voteBalance: voteBalance
            };
            genreEntries.push(genreEntry);
        });
    }
    scrapeVotingEntries(primary);
    scrapeVotingEntries(secondary);
    genreEntries.sort((a, b) => b.voteBalance - a.voteBalance);
    
    const primaryGenreEntries = genreEntries.filter(genreEntry => genreEntry.level === 'Primary');
    const secondaryGenreEntries = genreEntries.filter(genreEntry => genreEntry.level === 'Secondary');

    // const threshold = require('./thresholds').tag;
    const threshold = primaryGenreEntries[0].voteBalance;
    const differential = primaryGenreEntries[1] ? threshold - primaryGenreEntries[1].voteBalance : 0;

    function filterGenres() {
        const primaryGenres = primaryGenreEntries.filter(genreEntry => genreEntry.voteBalance >= threshold).map(genreEntry => genreEntry.genre);
        const secondaryGenres = secondaryGenreEntries.filter(genreEntry => genreEntry.voteBalance >= threshold).map(genreEntry => {
            return {
                genre: genreEntry.genre,
                secondaryDifferential: genreEntry.voteBalance - threshold,
            }
        });

        if (primaryGenres.length > 1) throw "Error: multiple primary genres";

        return {
            primary: primaryGenres[0],
            secondary: secondaryGenres,
            differential,
        };
    }

    const genreData = {
        id: release,
        ...(type === 'Album' && {trackNumber}),
        genres: filterGenres()
    };
    return genreData;
}

async function saveGenreData(type) {
    // const Release = mongoose.model(type, {
    //     'listing': Number,
    //     'id': String,
    //     'releaseDate': {
    //         'year': Number,
    //         'month': Number,
    //         'day': Number
    //     },
    //     'score': Number,
    //     'ratingCount': Number,
    //     'genres': {
    //         'primary': String,
    //         'secondary': [String]
    //     },
    //     'descriptors': [String]
    // });

    const genreData = await getGenres('Vote on genres - Rate Your Music', type);
    console.log(`${JSON.stringify(genreData, null, 1)}`);
    // await Release.updateOne({ id: genreData.id }, { genres: genreData.genres });
    // console.log('Saved!');
    process.exit();
}

// db.on('error', console.error.bind(console, 'connection error:'));
// db.once('open', () => {
    // console.log('Connected!');
    saveGenreData(type);
// });
