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
        var fieldName = $(this).attr('data-fieldname');
        var widgetSettings = settings.resource_timeslots_setup[fieldName];
        var maxValues = Number(widgetSettings.maxValues);
        var validRange = widgetSettings.validRange;
        if (widgetSettings.reserved.hasOwnProperty(resourceId)) {
          reserved.events = widgetSettings.reserved[resourceId];
        }
        var fcData = $(this).parent('.form-item').next('.fc-data').val();
        var currentItems = [];
        // Catch empty value after form validation failures.
        if (fcData !== '') {
          currentItems = JSON.parse(fcData);
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
            let count = resourceTimeslotWidget.updateFieldValue(calendarId, calendar.getEvents(), widgetSettings);
            // Consider field cardinality.
            if (count >= maxValues) {
              calendar.setOption('selectable', false);
            }
          },
          eventResize: function(info) {
            resourceTimeslotWidget.updateFieldValue(calendarId, calendar.getEvents(), widgetSettings);
          },
          eventDrop: function(info) {
            resourceTimeslotWidget.updateFieldValue(calendarId, calendar.getEvents(), widgetSettings);
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
              let count = resourceTimeslotWidget.updateFieldValue(calendarId, calendar.getEvents(), widgetSettings);
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
          var existingDates = [];
          for (let i = 0; i < currentItems.length; i++) {
            var slot = {
              start: new Date(currentItems[i].start),
              end: new Date(currentItems[i].end),
              classNames: ['current-items']
            }
            currentItems[i] = slot;
            existingDates[i] = {
              start: currentItems[i].start.getTime(),
              end: currentItems[i].end.getTime()
            }
            calendar.addEvent(slot);
          }
          resourceTimeslotWidget.renderDates($(this).parent().find('details p'), existingDates, widgetSettings);
          // Needed when php is not up-to-date with selected values.
          let summary = $(this).parent().find('details summary');
          resourceTimeslotWidget.updateSummary(summary, existingDates.length, (maxValues - existingDates.length));
          if (currentItems.length >= maxValues) {
            calendar.setOption('selectable', false);
          }
          // Make sure existing items are always accessible, even if in the past.
          var rangeStart = new Date(options.validRange.start);
          if (rangeStart.getTime() > currentItems[0].start.getTime()) {
            var pastRange = {
              start: currentItems[0].start,
              end: widgetSettings.validRange.end
            };
            calendar.setOption('validRange', pastRange);
          }
          // Go to the first existing slot.
          calendar.gotoDate(currentItems[0].start);
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
          resourceTimeslotWidget.resetFieldValue(calendarId, widgetSettings);
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
   * @param array settings
   *   This field's widget settings.
   *
   * @return int
   *   Number of current events.
   */
  resourceTimeslotWidget.updateFieldValue = function (selector, values, settings) {
    var result = [];
    var maxvalues = Number(settings.maxValues);
    // Using timestamps (msec) seems more reliable across browsers.
    for (let i = 0; i < values.length; i++) {
      // Filter out the current (dynamic) items.
      if (values[i].classNames.indexOf('current-items') > -1) {
        result.push({
          start: values[i].start.getTime(),
          end: values[i].end.getTime()
        });
      }
    }
    var parent = $('#' + selector).parent().parent();
    parent.find('.fc-data').val(JSON.stringify(result));

    // Display info about remaining slots.
    var avail = maxvalues - result.length;
    var summary = parent.find('details summary');
    resourceTimeslotWidget.updateSummary(summary, result.length, avail);
    resourceTimeslotWidget.renderDates(parent.find('details p'), result, settings);

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
  resourceTimeslotWidget.resetFieldValue = function (selector, settings) {
    var parent = $('#' + selector).parent().parent();
    var summary = parent.find('details summary');
    parent.find('.fc-data').val('');
    resourceTimeslotWidget.updateSummary(summary, '0', settings.maxValues);
    parent.find('details p').text('');
    parent.removeClass('slot-selected');
  };

  /**
   * Render selected dates in the details element.
   *
   * @param oject selector
   *   Jquery object to append content to.
   * @param array dates
   *   Array of objects, keyed by start and end.
   * @param object settings
   *   Widget settings.
   */
  resourceTimeslotWidget.renderDates = function (selector, dates, settings) {
    var dateonly = false;
    if (settings.calendarType === 'dayGridMonth') {
      dateonly = true;
    }
    selector.text('');

    if (dates.length) {
      for (let i = 0; i < dates.length; i++) {
        var startDate = new Date(dates[i].start);
        var endDate = new Date(dates[i].end);
        // Date and time format based on browsers locales, without seconds.
        var locale_s = new Date(startDate).toLocaleDateString();
        var locale_e = new Date(endDate).toLocaleDateString();
        if (dateonly === false) {
          if (locale_s === locale_e) {
            // If start and end date are the same, only print it once.
            locale_e = endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          }
          else {
            locale_e += ' ' + endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          }
          locale_s += ' ' + startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        var output = locale_s + ' - ' + locale_e + '<br>';
        selector.append(output);
      }
    }
  }

  /**
   * Update the displayed info about available slots.
   *
   * @param object selector
   *   Jquery object to update the text.
   * @param int selectedCound
   *   Number of already selected slots.
   * @param int availableCount
   *   Number of remaining slots, based on field cardinality.
   */
  resourceTimeslotWidget.updateSummary = function (selector, selectedCount, availableCount) {
    var info = Backdrop.t('@selected slot(s) selected, @avail available.', {
      '@selected': selectedCount,
      '@avail': availableCount
    });
    selector.text(info);
  }

})(jQuery);
