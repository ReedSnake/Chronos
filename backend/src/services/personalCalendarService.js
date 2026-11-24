const Calendar = require('../models/Calendar');
const User = require('../models/User');

// The unique partial indexes are the concurrency boundary. A duplicate from a
// parallel request means the other request provisioned the same calendar.
async function upsertCalendar(filter, update) {
  try {
    return await Calendar.findOneAndUpdate(filter, update, {
      upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await Calendar.findOneAndUpdate(filter, update.$set ? { $set: update.$set } : { $set: {} }, { new: true, runValidators: true });
    if (!existing) throw error;
    return existing;
  }
}

async function ensureMainCalendar(user) {
  // Wait for index creation before upserting, including on a fresh database.
  await Calendar.init();
  const filter = { ownerUserId: user._id, isMain: true };
  const current = await Calendar.findOne(filter);
  if (current && !current.isArchived) return current;
  return upsertCalendar(filter, {
    $setOnInsert: { ownerUserId: user._id, isMain: true, name: 'Personal', timeZone: user.settings?.timeZone || 'UTC', countryCode: user.country || null },
    $set: { isArchived: false },
  });
}

async function ensurePersonalCalendars(userId) {
  const user = await User.findById(userId).select('country settings').lean();
  if (!user) return;
  await ensureMainCalendar(user);
  const holidayFilter = { ownerUserId: userId, isHolidayCalendar: true };
  const holiday = await Calendar.findOne(holidayFilter);
  if (!user.country) {
    if (holiday?.countryCode) await Calendar.updateOne(holidayFilter, { $set: { countryCode: null } });
    return;
  }
  if (holiday?.countryCode === user.country) return;
  await upsertCalendar(holidayFilter, {
    $setOnInsert: { ownerUserId: userId, isHolidayCalendar: true, name: 'National holidays', color: '#D97706', timeZone: 'UTC', isMain: false },
    $set: { countryCode: user.country },
  });
}

module.exports = { ensureMainCalendar, ensurePersonalCalendars };
