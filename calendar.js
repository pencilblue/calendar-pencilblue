/*
    Copyright (C) 2015  PencilBlue, LLC

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

var async = require('async');
var co = require('co');


module.exports = function(pb) {
    
    //pb dependencies
    var util           = pb.util;
    var PluginService  = pb.PluginService;
    var ContentService = pb.ContentService;
    
    /**
     * Calendar - Manage events and display them within a calendar view.
     *
     * @author Blake Callens <blake@pencilblue.org>
     * @copyright 2014 PencilBlue, LLC
     */
    function Calendar(){}
    
    /**
     *
     * @private
     * @static
     * @readonly
     * @property VENUE_OBJ_TYPE
     */
    var VENUE_OBJ_TYPE = 'pb_calendar_venue';
    
    /**
     *
     * @private
     * @static
     * @readonly
     * @property EVENT_OBJ_TYPE
     */
    var EVENT_OBJ_TYPE = 'pb_calendar_event';
    
    /**
     *
     * @private
     * @static
     * @readonly
     * @property TYPE_URL_PATH
     */
    var TYPE_URL_PATH = '/admin/content/objects/';
    
    /**
     *
     * @private
     * @static
     * @readonly
     * @property FIELD_TYPE_TEXT
     */
    var FIELD_TYPE_TEXT = Object.freeze({
        field_type: 'text'
    });
    
    /**
     *
     * @private
     * @static
     * @readonly
     * @property FIELD_TYPE_DATE
     */
    var FIELD_TYPE_DATE = Object.freeze({
        field_type: 'date'
    });

    /**
     * Called when the application is being installed for the first time.
     *
     * @param cb A callback that must be called upon completion.  cb(err, result).
     * The result is ignored
     */
    Calendar.onInstall = function(cb) {
        var self = this;
        var cos = new pb.CustomObjectService();

        this.setupVenuesType = function() {
            cos.loadTypeByName(VENUE_OBJ_TYPE, function(err, venueType) {
                if (venueType) {
                    return cb(null, true);
                }

                var venueValues = {
                    name: VENUE_OBJ_TYPE, 
                    fields: {
                        name: FIELD_TYPE_TEXT,
                        description: FIELD_TYPE_TEXT, 
                        address: FIELD_TYPE_TEXT, 
                        url: FIELD_TYPE_TEXT
                    }
                };
                cos.saveType(venueValues, function(err, venueType) {
                    self.setupEventsType();
                });
            });
        };

        this.setupEventsType = function() {
            cos.loadTypeByName(EVENT_OBJ_TYPE, function(err, eventType) {
                if (eventType) {
                    return cb(null, true);
                }
                
                var eventValues = {
                    name: EVENT_OBJ_TYPE, 
                    fields: {
                        name: FIELD_TYPE_TEXT, 
                        start_date: FIELD_TYPE_DATE, 
                        end_date: FIELD_TYPE_DATE, 
                        description: FIELD_TYPE_TEXT, 
                        venue: {
                            field_type: 'peer_object', 
                            object_type: 'custom:pb_calendar_venue'
                        }, 
                        url: FIELD_TYPE_TEXT, 
                        topics: {
                            field_type: 'child_objects', 
                            object_type: 'topic'
                        }
                    }
                };
                cos.saveType(eventValues, function(err, eventType) {
                    cb(null, true);
                });
            });
        };

        this.setupVenuesType();
    };

    /**
     * Called when the application is uninstalling this plugin.  The plugin should
     * make every effort to clean up any plugin-specific DB items or any in function
     * overrides it makes.
     *
     * @param cb A callback that must be called upon completion.  cb(err, result).
     * The result is ignored
     */
    Calendar.onUninstall = function(cb) {
        cb(null, true);
    };

    /**
     * Called when the application is starting up. The function is also called at
     * the end of a successful install. It is guaranteed that all core PB services
     * will be available including access to the core DB.
     *
     * @param cb A callback that must be called upon completion.  cb(err, result).
     * The result is ignored
     */
    Calendar.onStartup = function(cb) {
        var self = this;
        var cos = new pb.CustomObjectService();
        var dao = new pb.DAO();

        cos.loadTypeByName(EVENT_OBJ_TYPE, function(err, eventType) {
            if(eventType) {
                pb.AdminSubnavService.registerFor('plugin_settings', function(navKey, localization, plugin) {
                    if(plugin.uid === 'calendar-pencilblue') {
                        return [
                            {
                                name: 'events',
                                title: 'Events',
                                icon: 'calendar',
                                href: TYPE_URL_PATH + eventType[pb.DAO.getIdField()]
                            }
                        ];
                    }
                    return [];
                });
            }

            cos.loadTypeByName(VENUE_OBJ_TYPE, function(err, venueType) {
                if(venueType) {
                    pb.AdminSubnavService.registerFor('plugin_settings', function(navKey, localization, plugin) {
                        if(plugin.uid === 'calendar-pencilblue') {
                            return [
                                {
                                    name: 'venues',
                                    title: 'Venues',
                                    icon: 'building-o',
                                    href: TYPE_URL_PATH + venueType[pb.DAO.getIdField()]
                                }
                            ];
                        }
                        return [];
                    });
                }
            });
        });

        pb.TemplateService.registerGlobal('pb_calendar_css', function(flag, cb) {
            var pluginService = new PluginService();
            pluginService.getSetting('calendar_css', 'calendar-pencilblue', function(err, calendarCSS) {
                cb(err, calendarCSS);
            });
        });

        pb.TemplateService.registerGlobal('pb_show_calendar', function(flag, cb) {
            var pluginService = new PluginService();
            pluginService.getSetting('display_as_list', 'calendar-pencilblue', function(err, displayAsList) {
                cb(err, displayAsList ? 'display: none' : '');
            });
        });

        pb.TemplateService.registerGlobal('pb_calendar_events_list_short', function(flag, cb) {
            var self = this;
            var now = new Date();
            var ts = new pb.TemplateService(new pb.Localization());
            var contentSettings;
            var eventData;
            var eventTemplate;
            var events = '';

            this.formatEvent = function(index) {
                if(index >= eventData.length) {
                    cb(null, new pb.TemplateValue(events, false));
                    return;
                }

                var defaultVenue = {
                    name: '',
                    address: '',
                    url: ''
                };

                var event = eventData[index];
                self.getVenue(event.venue, function(venue) {
                    var eventString = eventTemplate.split('^event_url^').join(event.url || '');
                    eventString = eventString.split('^event_id^').join(event[pb.DAO.getIdField()].toString());
                    eventString = eventString.split('^event_name^').join(event.name);
                    eventString = eventString.split('^event_date^').join(ContentService.getTimestampTextFromSettings(event.start_date, contentSettings, self.ls));
                    eventString = eventString.split('^venue_url^').join(venue.url || '');
                    eventString = eventString.split('^venue_name^').join(venue.name);
                    eventString = eventString.split('^venue_address^').join(venue.address);
                    eventString = eventString.split('^event_description^').join('');
                    eventString = eventString.split('^event_start_zulu^').join(self.getZuluTimestamp(event.start_date));
                    eventString = eventString.split('^event_end_zulu^').join(self.getZuluTimestamp(event.end_date));
                    self.getTopics(event.topics, function(topics) {
                        eventString = eventString.split('^event_topics^').join(topics);
                    });

                    events += eventString;
                    index++;
                    self.formatEvent(index);
                });
            };

            this.getVenue = function(venueId, cb) {
                var defaultVenue = {
                    name: '',
                    address: '',
                    url: ''
                };

                if(!venueId || !pb.validation.isIdStr(venueId)) {
                    cb(defaultVenue);
                    return;
                }

                dao.loadById(venueId, 'custom_object', function(error, venue) {
                    if(!venue) {
                        cb(defaultVenue);
                        return;
                    }

                    cb(venue);
                });
            };

            this.getZuluTimestamp = function(date) {
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

            var contentService = new ContentService();
            contentService.getSettings(function(err, settings) {
                //handle error
                contentSettings = settings;

                ts.load('elements/event_index', function(err, eventTemp) {
                    //handle error
                    eventTemplate = eventTemp;

                    cos.loadTypeByName(EVENT_OBJ_TYPE, function(err, eventType) {
                        if(util.isError(err) || !eventType) {
                            return cb(err, '');
                        }

                        var opts = {
                            where: {
                                end_date: {$gte: now}
                            },
                            order: {
                                start_date: pb.DAO.ASC
                            }
                        };
                        cos.findByType(eventType, opts, function(err, eventObjects) {
                            if(util.isError(err) || !util.isArray(eventObjects)) {
                                return cb(err, '');
                            }
                            
                            eventData = eventObjects;
                            formatEvent(0);
                        });
                    });
                });
            });
        });

        pb.TemplateService.registerGlobal('pb_calendar_events_list', function(flag, cb) {
            var self = this;
            var now = new Date();
            var ts = new pb.TemplateService(new pb.Localization());
            var contentSettings;
            var eventData;
            var eventTemplate;
            var events = '';

            this.formatEvent = function(index) {
                if(index >= eventData.length) {
                    cb(null, new pb.TemplateValue(events, false));
                    return;
                }

                var defaultVenue = {
                    name: '',
                    address: '',
                    url: ''
                };

                var event = eventData[index];
                self.getVenue(event.venue, function(venue) {
                    var eventString = eventTemplate.split('^event_url^').join(event.url || '');
                    eventString = eventString.split('^event_id^').join(event[pb.DAO.getIdField()].toString());
                    eventString = eventString.split('^event_name^').join(event.name);
                    eventString = eventString.split('^event_date^').join(ContentService.getTimestampTextFromSettings(event.start_date, contentSettings, self.ls));
                    eventString = eventString.split('^venue_url^').join(venue.url || '');
                    eventString = eventString.split('^venue_name^').join(venue.name);
                    eventString = eventString.split('^venue_address^').join(venue.address);
                    eventString = eventString.split('^event_description^').join(event.description);
                    eventString = eventString.split('^event_start_zulu^').join(self.getZuluTimestamp(event.start_date));
                    eventString = eventString.split('^event_end_zulu^').join(self.getZuluTimestamp(event.end_date));

                    var tasks = util.getTasks(event.topics, function(topic, i) {
                        return function(callback) {
                            dao.loadById(event.topics[i], 'topic', function(error, t) {
                                var html = '<a class="ssf-topic label" href="/topic/' + t.name + '">' + t.name + '</a>';
                                callback(null, html)
                            });
                        };
                    });

                    async.parallel(tasks, function(err, results) {
                        eventString = eventString.split('^event_topics^').join(results.join(' '));
                        events += eventString;
                        index++;
                        self.formatEvent(index);
                    });
                });
            };

            this.getTopics = function(topics, cb) {
                var topicDescriptions = [];
                async.series([
                    function(callback) {
                        for(var i = 0; i < topics.length; i++) {
                            dao.loadById(topics[i], 'topic', function(error, t) {
                                topicDescriptions.push(t.name);
                                if(i === topics.length) callback(null, null);
                            });
                        }
                    }
                ],
                function(err, results) {
                    if(topicDescriptions.length === topics.length) {
                        cb(topicDescriptions);
                    }
                });
            };

            this.getVenue = function(venueId, cb) {
                var defaultVenue = {
                    name: '',
                    address: '',
                    url: ''
                };

                if(!venueId || !pb.validation.isIdStr(venueId)) {
                    cb(defaultVenue);
                    return;
                }

                dao.loadById(venueId, 'custom_object', function(error, venue) {
                    if(!venue) {
                        cb(defaultVenue);
                        return;
                    }

                    cb(venue);
                });
            };

            this.getZuluTimestamp = function(date) {
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

            var contentService = new ContentService();
            contentService.getSettings(function(err, settings) {
                //handle error
                contentSettings = settings;

                ts.load('elements/event', function(err, eventTemp) {
                    //handle error
                    eventTemplate = eventTemp;

                    cos.loadTypeByName(EVENT_OBJ_TYPE, function(err, eventType) {
                        if(util.isError(err) || !eventType) {
                            return cb(err, '');
                        }

                        var opts = {
                            where: {
                                end_date: {$gte: now}
                            },
                            order: {
                                start_date: pb.DAO.ASC
                            }
                        };
                        cos.findByType(eventType, opts, function(err, eventObjects) {
                            if(util.isError(err) || !util.isArray(eventObjects)) {
                                return cb(err, '');
                            }
                            
                            eventData = eventObjects;
                            formatEvent(0);
                        });
                    });
                });
            });
        });

        pb.TemplateService.registerGlobal('pb_calendar_events', function(flag, cb) {
            cos.loadTypeByName(EVENT_OBJ_TYPE, function(err, eventType) {
                if(!eventType) {
                    return cb(err, '[]');
                }

                var now = new Date();
                var timezoneOffset = now.getTimezoneOffset() * 1000 * 60;

                
                var opts = {
                    where: {
                        type: eventType[pb.DAO.getIdField()].toString()
                    }
                };
                cos.findByType(eventType, opts, function(err, eventObjects) {
                    if (util.isError(err)) {
                        return cb(err, '');
                    }
                
                    var events = [];
                    eventObjects.forEach(function(obj) {
                        var event = {
                            title: obj.name,
                            topics: obj.topics,
                            start: new Date(obj.start_date).getTime() - timezoneOffset,
                            end: new Date(obj.end_date).getTime() - timezoneOffset,
                            url: (new Date(obj.end_date) >= now) ? 'javascript:$("#event_' + obj[pb.DAO.getIdField()].toString() + '")[0].scrollIntoView(true)' : null
                        };

                        events.push(event);
                    });

                    cb(null, new pb.TemplateValue(JSON.stringify(events), false));
                });
            });
        });

        cb(null, false);
    };

    /**
     * Called when the application is gracefully shutting down.  No guarantees are
     * provided for how much time will be provided the plugin to shut down.
     *
     * @param cb A callback that must be called upon completion.  cb(err, result).
     * The result is ignored
     */
    Calendar.onShutdown = function(cb) {
        cb(null, true);
    };

    //exports
    return Calendar;
};
