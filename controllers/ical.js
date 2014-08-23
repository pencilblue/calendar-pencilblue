/*
    Copyright (C) 2014  PencilBlue, LLC

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

function ICalFile() {}

//dependencies
var PluginService = pb.PluginService;

//inheritance
util.inherits(ICalFile, pb.BaseController);

ICalFile.prototype.render = function(cb) {
    var self = this;
    var dao = new pb.DAO();

    dao.loadById(this.pathVars.id, 'custom_object', function(error, event) {
        if(!event) {
            self.reqHandler.serve404();
            return;
        }

        dao.loadById(event.venue, 'custom_object', function(error, venue) {
            self.ts.registerLocal('event_id', event._id.toString());
            self.ts.registerLocal('event_name', event.name);
            self.ts.registerLocal('event_description', event.description);
            self.ts.registerLocal('venue_address', venue.address);
            self.ts.registerLocal('site_com', pb.config.siteIP);
            self.ts.registerLocal('event_start_zulu', self.getZuluTimestamp(event.start_date));
            self.ts.registerLocal('event_end_zulu', self.getZuluTimestamp(event.end_date));
            self.ts.load('/elements/event/ical', function(err, result) {

                var content = {
                    content: result,
                    content_type: "application/octet-stream",
                    filneame: 'event.ics',
                    code: 200
                };
                cb(content);
            });
        });
    });
};

ICalFile.prototype.getZuluTimestamp = function(date) {
    var month = date.getUTCMonth() + 1;
    if(month < 10) {
        month = '0' + month;
    }

    var day = date.getUTCDate();
    if(day < 10) {
        day = '0' + day;
    }

    var hours = date.getUTCHours();
    if(hours < 10) {
        hours = '0' + hours;
    }

    var minutes = date.getUTCMinutes();
    if(minutes < 10) {
        minutes = '0' + minutes;
    }

    return date.getUTCFullYear() + month + day + 'T' + hours + minutes + '00Z';
};

ICalFile.getRoutes = function(cb) {
    var routes = [
        {
            method: 'get',
            path: '/events/:id/event.ics',
            auth_required: false,
            content_type: 'application/octet-stream'
        }
    ];
    cb(null, routes);
};

//exports
module.exports = ICalFile;
