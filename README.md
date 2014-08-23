[Events Calendar for PencilBlue](http://pencilblue.org)
=====

##### Display events in a responsive calendar layout

Installation and Setup
-----

1. Clone the calendar-pencilblue repository into the plugins folder of your PencilBlue installation
```shell
cd [pencilblue_directory]/plugins
git clone https://github.com/pencilblue/calendar-pencilblue.git
```

2. Install the calendar-pencilblue plugin through the manage plugins screen in the admin section (/admin/plugins).

3. Go to the calendar-pencilblue settings screen (/admin/plugins/settings/calendar-pencilblue) and set whether you want a visual calendar and list view or just a list view. You can also point to a custom CSS file, where you can restyle the calendar template.

4. Calendar events require a venue (venue's do not have to be physical). Click on the *Venue* button on the calender-pencilblue settings screen and add a venue object.

5. Go back to the calendar-pencilblue plugins settings screen and click on the *Events* button (both venues and events are custom objects, so you can also reach them from the standard manage custom objects screen). Create an event and save.

5. Add the ^tmp_calendar^ directive to any HTML template and the calendar will now be automatically loaded.
