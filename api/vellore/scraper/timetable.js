/*
 *  VITacademics
 *  Copyright (C) 2014  Aneesh Neelam <neelam.aneesh@gmail.com>
 *  Copyright (C) 2014  Saurabh Joshi <battlex94@gmail.com>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var cache = require('memory-cache');
var cheerio = require('cheerio');
var cookie = require('cookie');
var path = require('path');
var unirest = require('unirest');

var errors = require(path.join(__dirname, '..', '..', 'error'));


exports.scrapeTimetable = function (RegNo, sem, firsttime, callback)
{
    var timetableUri = 'https://academics.vit.ac.in/parent/timetable.asp?sem=' + sem;
    var CookieJar = unirest.jar();
    var myCookie = cache.get(RegNo);
    var cookieSerial = cookie.serialize(myCookie[0], myCookie[1]);
    var onRequest = function (response)
    {
        if (response.error)
        {
            callback(true, {Error: errors.codes.Down});
        }
        else
        {
            var timetable = {
                Courses: [],
                Timetable: {}
            };
            try
            {
                var tmp = {};
                var scraper = cheerio.load(response.body);
                scraper = cheerio.load(scraper('table table').eq(0).html());
                var length = scraper('tr').length;
                var onEach = function (i, elem)
                {
                    var $ = cheerio.load(scraper(this).html());
                    if (i > 0 && i < (length - 1))
                    {
                        var classnbr = $('td').eq(1).text();
                        var code = $('td').eq(2).text();
                        var courseType = $('td').eq(4).text();
                        if (courseType == 'Embedded Theory')
                        {
                            code = code + 'ETH';
                        }
                        else if (courseType == 'Embedded Lab')
                        {
                            code = code + 'ELA';
                        }
                        else if (courseType == 'Theory Only')
                        {
                            code = code + 'TH';
                        }
                        else if (courseType == 'Lab Only')
                        {
                            code = code + 'LO';
                        }
                        tmp[code] = classnbr;
                        timetable['Courses'].push({
                                                      'Class Number': classnbr,
                                                      'Course Code': $('td').eq(2).text(),
                                                      'Course Title': $('td').eq(3).text(),
                                                      'Course Type': courseType,
                                                      'LTPC': $('td').eq(5).text(),
                                                      'Course Mode': $('td').eq(6).text(),
                                                      'Course Option': $('td').eq(7).text(),
                                                      'Slot': $('td').eq(8).text(),
                                                      'Venue': $('td').eq(9).text(),
                                                      'Faculty': $('td').eq(10).text(),
                                                      'Registration Status': $('td').eq(11).text()
                                                  });
                    }
                };
                scraper('tr').each(onEach);
                if (firsttime)
                {
                    scraper = cheerio.load(response.body);
                    scraper = cheerio.load(scraper('table table').eq(1).html());
                    length = scraper('tr').length;
                    var onEachRow = function (i, elem)
                    {
                        var day = [];
                        var $ = cheerio.load(scraper(this).html());
                        if (i > 1)
                        {
                            length = $('td').length;
                            for (var elt = 1; elt < length; elt++)
                            {
                                var text = $('td').eq(elt).text().split(' ');
                                var sub = text[0] + text[2];
                                if (tmp[sub])
                                {
                                    day.push(Number(tmp[sub]));
                                }
                                else
                                {
                                    day.push(0);
                                }
                            }
                            switch (i)
                            {
                                case 2:
                                    timetable.Timetable.Mon = day;
                                    break;
                                case 3:
                                    timetable.Timetable.Tue = day;
                                    break;
                                case 4:
                                    timetable.Timetable.Wed = day;
                                    break;
                                case 5:
                                    timetable.Timetable.Thu = day;
                                    break;
                                case 6:
                                    timetable.Timetable.Fri = day;
                                    break;
                                case 7:
                                    timetable.Timetable.Sat = day;
                                    break;
                            }
                        }
                    };
                    scraper('tr').each(onEachRow);
                }
                timetable.Error = errors.codes.Success;
                callback(null, timetable);
            }
            catch (ex)
            {
                // Scraping Timetable failed
                callback(true, {Error: errors.codes.Invalid});
            }
        }
    };
    CookieJar.add(unirest.cookie(cookieSerial), timetableUri);
    unirest.post(timetableUri)
        .jar(CookieJar)
        .end(onRequest);
};
