(function ($) {

  'use strict';

  var resourceTimeslotWidget = resourceTimeslotWidget || {};

  Backdrop.behaviors.resourceTimeslot = {
    attach: function (context, settings) {

      $('.dt-range-fullcal').each(function (i, item) {
        var calendarId = item.attributes.id.nodeValue;
        var calendarEl = document.getElementById(calendarId);

        var dateInitial = null;
        var selectFormItem = $(this).parent('.form-item').prev('.form-type-select');
        var resourceId = selectFormItem.find('option:selected').val();
        var resourceTitle = selectFormItem.find('option:selected').text();
        var reserved = { id: 'reserved', events: [] };
        var fcData = $(this).parent('.form-item').next('.fc-data').val();
        var currentItems = JSON.parse(fcData);
        var fieldName = $(this).attr('data-fieldname');
        var widgetSettings = settings.resource_timeslots_setup[fieldName];
        var maxValues = Number(widgetSettings.maxValues);
        var validRange = widgetSettings.validRange;
        if (widgetSettings.reserved.hasOwnProperty(resourceId)) {
          reserved.events = widgetSettings.reserved[resourceId];
        }

        var options = {
          firstDay: widgetSettings.firstDay,
          locale: widgetSettings.langCode,
          headerToolbar: {
            left: 'prev',
            center: 'title',
            right: 'next'
          },
          longPressDelay: 800,
          initialView: widgetSettings.calendarType,
          height: 'auto',
          allDaySlot: false,
          eventSources: [ reserved ],
          eventOverlap: false,
          selectOverlap: false,
          editable: true,
          selectable: true,
          validRange: validRange,
          initialDate: dateInitial,
          slotDuration: widgetSettings.minSlotSize,
          select: function(info) {
            calendar.addEvent({
              title: resourceTitle,
              start: info.startStr,
              end: info.endStr,
              classNames: ['current-items']
            });
            let count = resourceTimeslotWidget.updateFieldValue(calendarId, calendar.getEvents(), maxValues);
            // Consider field cardinality.
            if (count >= maxValues) {
              calendar.setOption('selectable', false);
            }
          },
          eventResize: function(info) {
            resourceTimeslotWidget.updateFieldValue(calendarId, calendar.getEvents(), maxValues);
          },
          eventDrop: function(info) {
            resourceTimeslotWidget.updateFieldValue(calendarId, calendar.getEvents(), maxValues);
          },
          eventContent: function(arg) {
            if (arg.event._def.ui.display === 'background') {
              return '';
            }
            // Improvised close button.
            var markup = '<div class="remove-btn">Remove</div><div class="event-title">' + resourceTitle + '</div>';
            markup += '<div class="event-text">' + arg.timeText + '</div>';
            return { html: markup };
          },
          eventClick: function(info) {
            if (info.jsEvent.srcElement.className === 'remove-btn') {
              info.event.remove();
              let count = resourceTimeslotWidget.updateFieldValue(calendarId, calendar.getEvents(), maxValues);
              if (count < maxValues) {
                calendar.setOption('selectable', true);
              }
            }
          }
        };

        if (widgetSettings.businessHours !== null) {
          options.businessHours = widgetSettings.businessHours;
          options.eventConstraint = widgetSettings.businessHours;
          options.selectConstraint = widgetSettings.businessHours;
          options.slotMinTime = widgetSettings.businessHours.startTime;
          options.slotMaxTime = widgetSettings.businessHours.endTime;
        }

        // Let modules or themes override options by adding a js setting
        // 'resource_timeslots_custom' to the page.
        $.extend(options, settings.resource_timeslots_custom);

        var calendar = new FullCalendar.Calendar(calendarEl, options);

        if (widgetSettings.calendarType == 'timeGridWeek') {
          calendar.setOption('firstDay', new Date(validRange.start).getDay());
        }

        if (currentItems.length) {
          for (let i = 0; i < currentItems.length; i++) {
            var slot = {
              start: new Date(currentItems[i].start),
              end: new Date(currentItems[i].end),
              classNames: ['current-items']
            }
            currentItems[i] = slot;
            calendar.addEvent(slot);
          }
          if (currentItems.length >= maxValues) {
            calendar.setOption('selectable', false);
          }
          // Make sure existing items are always accessible, even if in the past.
          var rangeStart = new Date(options.validRange.start);
          if (rangeStart.getTime() > currentItems[0].start.getTime()) {
            var pastRange = {
              start: currentItems[0].start.toUTCString(),
              end: widgetSettings.validRange.end
            };
            calendar.setOption('validRange', pastRange);
          }
          // Go to the first existing slot.
          calendar.gotoDate(slot.start);
        }
        calendar.render();

        // Maybe a race condition, but the feed doesn't initially work if the
        // resource ID got set via GET param. So we fetch after render, which
        // seems to work.
        var feed = {
          id: 'feed',
          url: null
        };
        if (widgetSettings.feedUrl !== null) {
          if (resourceId > 0) {
            feed.url = widgetSettings.feedUrl.replace('{ID}', resourceId);
            calendar.addEventSource(feed);
          }
        }

        selectFormItem.find('select').change(function () {
          // When switching resources, reserved values are different. Remove the
          // old Event objects to prevent overlap.
          var allEvents = calendar.getEvents();
          for (let i = 0; i < allEvents.length; i++) {
            if (allEvents[i].classNames.indexOf('current-items') > -1) {
              allEvents[i].remove();
            }
          }
          resourceTimeslotWidget.resetFieldValue(calendarId);
          calendar.setOption('selectable', true);

          // Get infos and reserved slots for currently selected resource.
          resourceId = $(this).find('option:selected').val();
          resourceTitle = $(this).find('option:selected').text();
          reserved.events = [];
          if (widgetSettings.reserved.hasOwnProperty(resourceId)) {
            reserved.events = widgetSettings.reserved[resourceId];
          }
          let eventSourceLocal = calendar.getEventSourceById('reserved');
          if (eventSourceLocal !== null) {
            // Can this ever be null?
            eventSourceLocal.remove();
          }
          calendar.addEventSource(reserved);

          // Update feed.
          if (widgetSettings.feedUrl !== null) {
            if (resourceId > 0) {
              feed.url = widgetSettings.feedUrl.replace('{ID}', resourceId);
              let eventSourceFeed = calendar.getEventSourceById('feed');
              if (eventSourceFeed !== null) {
                eventSourceFeed.remove();
              }
              calendar.addEventSource(feed);
            }
          }
        });

      });
    }
  };

  /**
   * Utility functions.
   */

  /**
   * @param string selector
   *   HTML ID of the current calendar container.
   * @param array values
   *   Array of all Fullcalendar event objects, including background events.
   * @param int maxvalues
   *   Max available values, field granularity.
   *
   * @return int
   *   Number of current events.
   */
  resourceTimeslotWidget.updateFieldValue = function (selector, values, maxvalues) {
    var result = [];
    // Take special care with Safari.
    // @see https://stackoverflow.com/questions/54726314/safari-returns-incorrect-value-for-date-toisostring
    // It's probably broken again.
    for (let i = 0; i < values.length; i++) {
      // Filter out the current (dynamic) items.
      if (values[i].classNames.indexOf('current-items') > -1) {
        result.push({
          start: values[i].start,
          end: values[i].end
        });
      }
    }
    var parent = $('#' + selector).parent().parent();
    parent.find('.fc-data').val(JSON.stringify(result));

    // Display info about remaining slots.
    var avail = maxvalues - result.length;
    var info = Backdrop.t('@selected slot(s) selected, @avail available.', {
      '@selected': result.length,
      '@avail': (maxvalues - result.length)
    });
    parent.find('.start-end-display').text(info);

    // Allow different styling, if a slot is selected.
    if (result.length > 0) {
      parent.addClass('slot-selected');
    }
    else {
      parent.removeClass('slot-selected');
    }
    return result.length;
  };

  /**
   * Empty the hidden input value and related data.
   *
   * @param string selector
   *   CSS selector calendar ID.
   */
  resourceTimeslotWidget.resetFieldValue = function (selector) {
    var parent = $('#' + selector).parent().parent();
    parent.find('.fc-data').val('');
    parent.find('.start-end-display').text('');
    parent.removeClass('slot-selected');
  };

})(jQuery);
