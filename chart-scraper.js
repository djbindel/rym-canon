const cheerio = require('cheerio');
const fs = require('fs');
const util = require('util');
// const mongoose = require('mongoose');
// const models = require('./models');
const chart = process.argv.slice(2)[0];
const startingPoint = process.argv.slice(2)[1];

// mongoose.connect('mongodb://localhost:27017', {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
// });

// const db = mongoose.connection;

const readdirAsync = util.promisify(fs.readdir);
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);

const months = {
    January: '1',
    February: '2',
    March: '3',
    April: '4',
    May: '5',
    June: '6',
    July: '7',
    August: '8',
    September: '9',
    October: '10',
    November: '11',
    December: '12'
};
const averageLengthMonths = ['April', 'June', 'September', 'November'];

function isLeapYear(year) {
    if (year % 4 !== 0) return false;
    if (year % 100 !== 0) return true;
    if (year % 400 !== 0) return false;
    return true;
}

function getMonthMidpoint(year, month) {
    if (month === 'February') {
        if (isLeapYear(year)) {
            return '15';
        } else return '14.5';
    } else if (averageLengthMonths.includes(month)) {
        return '15.5';
    } else return '16';
}

function getYearMidpoint(year) {
    if (isLeapYear(year)) {
        return {
            month: '7',
            day: '1.5'
        };
    } else return {
        month: '7',
        day: '2'
    };
}

function approximateReleaseDate(parsedReleaseDate) {
    const year = parsedReleaseDate[3] || null;
    const month = parsedReleaseDate[2] || null;
    const day = parsedReleaseDate[1] || null;

    if (year && month && day) {
        return {
            year: year,
            month: months[month],
            day: day
        };
    } else if (year && month) {
        const monthMidpoint = getMonthMidpoint(year, month);
        return {
            year: year,
            month: months[month],
            day: monthMidpoint
        };
    } else if (year) {
        const yearMidpoint = getYearMidpoint(year);
        return {
            year: year,
            month: yearMidpoint.month,
            day: yearMidpoint.day
        };
    }
}

async function readAndSaveData(dirname, startingPoint) {
    let releases = [];
    const dir = await readdirAsync(dirname);
    for (file of dir) {
        console.log(file);
        const html = await readFileAsync(`./${dirname}/${file}`);
        const $ = cheerio.load(html);
        $('.page_section_charts_item_wrapper').each(function (i, element) {
            const listing = $(this).attr('id').replace('pos','');
            const link = $(this).find('.page_charts_section_charts_item_link').attr('href');
            console.log(link);
            const id = /^\/[^/]*\/(.*)\/$/.exec(link)[1];
            const artistLink = $(this).find('.page_charts_section_charts_item_credited_text').children('a:only-child').attr('href');
            const artistId = artistLink ? /artist\/([^/]*)$/.exec(artistLink)[1] : undefined;
            const releaseDate = $(this).find('.page_charts_section_charts_item_title_date_compact').children('span').first().text().trim();
            const parsedReleaseDate = /^(\d*?) ?([A-Za-z]*) ?(\d*)$/.exec(releaseDate);
            const approxReleaseDate = approximateReleaseDate(parsedReleaseDate);
            const genre = $(this).find('.page_charts_section_charts_item_genres_primary').text().trim();
            const stats = $(this).find('.page_charts_section_charts_item_credited_links_rating_compact');
            const score = stats.find('.page_charts_section_charts_item_details_average_num').text().trim();
            const ratingCount = stats.find('.page_charts_section_charts_item_details_ratings').find('.full').text().trim().replace(',','');

            const release = {
                id,
                listing: `${Number(startingPoint) + Number(listing)}`,
                ...(chart === 'Album' && { artistId }),
                score,
                // ratingCount,
                ...(chart === 'Album' || chart === 'Film' && {
                    year: approxReleaseDate['year'],
                    month: approxReleaseDate['month'],
                    day: approxReleaseDate['day'],
                }),
                ...(chart === 'Song' && { genre }),
            };
            console.log(release);
            releases.push(release);
        });
    }

    releases.sort((a, b) => a.listing - b.listing);
    // for (let release of releases) {
    //     const Release = models.release[chart];
    //     const document = new Release(release);
    //     await document.save();
    //     console.log(`Saved ${document.id}`);
    //     // release['placement'] = releases.indexOf(release) + 1;
    // }

    const header = Object.keys(releases[0]);
    const tsv = releases.map(row => header.map(fieldName => row[fieldName]).join('\t')).join('\n');

    await writeFileAsync('chart.tsv', tsv);
    console.log('Saved!');
    process.exit(0);
}

// db.on('error', console.error.bind(console, 'connection error:'));
// db.once('open', () => {
//     console.log('Connected!');
    readAndSaveData(`./charts/${chart}`, startingPoint);
// });
