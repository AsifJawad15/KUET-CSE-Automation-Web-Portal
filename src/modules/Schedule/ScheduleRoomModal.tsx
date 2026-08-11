"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  X, Loader2, Calendar, Clock, CheckCircle2,
  AlertCircle, ChevronRight, Building2, Zap, RotateCcw
} from 'lucide-react';
import { DatePicker, TimePicker } from '@/components/ui/FormPicker';

// ── Types ──────────────────────────────────────────────────
interface Room {
  room_number: string;
  room_type: string | null;
  building_name: string | null;
  capacity: number | null;
  is_active: boolean;
}

interface Period {
  id: number;
  start: string;
  end: string;
  label: string;
  available: boolean;
}

type BookingType = 'periodic' | 'continuous';
type Step = 'room' | 'type' | 'configure' | 'confirm';

interface Props {
  show: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  onSuccess: () => void;
}

// ── Helpers ────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function formatTime12(t: string): string {
  const [h = '0', m = '0'] = t.split(':');
  const hours = Number(h);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${m.padStart(2, '0')} ${suffix}`;
}

const BREAK_AFTER = [3, 6]; // period ids after which there's a break

// ── Component ──────────────────────────────────────────────
export default function ScheduleRoomModal({ show, onClose, selectedDate, onSuccess }: Props) {
  // Step control
  const [step, setStep] = useState<Step>('room');

  // Room selection
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('');

  // Booking date — starts from calendar selection but can be changed inside modal
  const [bookingDate, setBookingDate] = useState(selectedDate);

  // Booking type
  const [bookingType, setBookingType] = useState<BookingType>('periodic');

  // Periodic
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);

  // Continuous
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');

  // Label
  const [label, setLabel] = useState('');

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Reset on open ──────────────────────────────────────
  useEffect(() => {
    if (show) {
      setStep('room');
      setSelectedRoom('');
      setBookingDate(selectedDate); // sync to current calendar date on each open
      setBookingType('periodic');
      setSelectedPeriod(null);
      setStartTime('08:00');
      setEndTime('09:00');
      setLabel('');
      setError(null);
      setSuccess(false);
    }
  }, [show, selectedDate]);

  // ── Fetch rooms ────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const data: Room[] = await res.json();
      setRooms(data.filter(r => r.is_active));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load rooms');
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    if (show) fetchRooms();
  }, [show, fetchRooms]);

  // ── Fetch period availability ──────────────────────────
  const fetchPeriods = useCallback(async (roomNum: string) => {
    setLoadingPeriods(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/schedule/book-room?room_number=${encodeURIComponent(roomNum)}&date=${bookingDate}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch availability');
      setPeriods(json.data?.periods ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load availability');
    } finally {
      setLoadingPeriods(false);
    }
  }, [bookingDate]);

  // ── Navigation ─────────────────────────────────────────
  const goToType = () => {
    if (!selectedRoom) return;
    setStep('type');
  };

  const goToConfigure = () => {
    if (bookingType === 'periodic') {
      fetchPeriods(selectedRoom);
    }
    setStep('configure');
  };

  const goToConfirm = () => {
    setError(null);
    if (bookingType === 'periodic' && !selectedPeriod) {
      setError('Please select a time slot');
      return;
    }
    if (bookingType === 'continuous') {
      const sm = Number(startTime.split(':')[0]) * 60 + Number(startTime.split(':')[1]);
      const em = Number(endTime.split(':')[0]) * 60 + Number(endTime.split(':')[1]);
      if (em <= sm) {
        setError('End time must be after start time');
        return;
      }
    }
    setStep('confirm');
  };

  // ── Submit ─────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const st = bookingType === 'periodic' ? selectedPeriod!.start : startTime;
    const et = bookingType === 'periodic' ? selectedPeriod!.end : endTime;

    try {
      const res = await fetch('/api/schedule/book-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_number: selectedRoom,
          booking_date: bookingDate,
          start_time: st,
          end_time: et,
          booking_type: bookingType,
          label: label.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Booking failed');

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Styles ─────────────────────────────────────────────
  const inputCls = 'w-full px-3 py-2.5 border border-gray-200 dark:border-[#3d4951] rounded-lg bg-white dark:bg-[#0b090a] text-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-400 dark:focus:ring-red-500 focus:border-transparent outline-none transition text-sm';
  const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-[#b1a7a6] uppercase tracking-wider mb-1.5';
  const btnPrimary = 'flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-red-600 dark:to-red-700 text-white rounded-xl font-semibold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  const availableCount = periods.filter(p => p.available).length;
  const roomInfo = rooms.find(r => r.room_number === selectedRoom);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161a1d] rounded-2xl w-full max-w-lg border border-gray-200 dark:border-[#3d4951] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#3d4951] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-indigo-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-800 dark:text-white">Schedule Room</h2>
                  <p className="text-xs text-gray-400 dark:text-[#b1a7a6]">{formatDate(bookingDate)}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* ── Progress steps ── */}
            <div className="px-6 py-3 border-b border-gray-100 dark:border-[#3d4951] flex-shrink-0">
              <div className="flex items-center gap-1">
                {(['room', 'type', 'configure', 'confirm'] as Step[]).map((s, i) => {
                  const stepIdx = ['room', 'type', 'configure', 'confirm'].indexOf(step);
                  const thisIdx = i;
                  const done = stepIdx > thisIdx;
                  const active = stepIdx === thisIdx;
                  return (
                    <div key={s} className="flex items-center gap-1 flex-1 last:flex-none">
                      <div className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                        done ? 'bg-green-500 text-white' :
                        active ? 'bg-indigo-600 dark:bg-red-600 text-white' :
                        'bg-gray-100 dark:bg-white/10 text-gray-400'
                      }`}>
                        {done ? '✓' : i + 1}
                      </div>
                      <span className={`text-[10px] font-medium capitalize ${active ? 'text-indigo-600 dark:text-red-400' : 'text-gray-400'}`}>
                        {s}
                      </span>
                      {i < 3 && <div className="flex-1 h-px bg-gray-200 dark:bg-white/10 mx-1" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Success */}
              {success && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center justify-center py-10 gap-4"
                >
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">Room Booked!</p>
                  <p className="text-sm text-gray-400">Refreshing schedule…</p>
                </motion.div>
              )}

              {/* ── Step: Room ── */}
              {!success && step === 'room' && (
                <div className="space-y-4">
                  {/* Date picker */}
                  <div>
                    <label className={labelCls}>Booking Date</label>
                    <DatePicker
                      value={bookingDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => {
                        setBookingDate(e.target.value);
                        // Reset period selection if date changes
                        setSelectedPeriod(null);
                        setPeriods([]);
                      }}
                    />
                    <p className="text-[11px] text-gray-400 dark:text-[#b1a7a6] mt-1">
                      {formatDate(bookingDate)}
                    </p>
                  </div>

                  {/* Room grid */}
                  <div>
                    <label className={labelCls}>Select Room</label>
                    {loadingRooms ? (
                      <div className="flex items-center gap-2 py-4 text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading rooms…
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                        {rooms.map(r => (
                          <button
                            key={r.room_number}
                            type="button"
                            onClick={() => setSelectedRoom(r.room_number)}
                            className={`text-left p-3 rounded-xl border-2 transition-all ${
                              selectedRoom === r.room_number
                                ? 'border-indigo-500 dark:border-red-500 bg-indigo-50 dark:bg-red-900/20'
                                : 'border-gray-200 dark:border-[#3d4951] hover:border-indigo-300 dark:hover:border-red-600/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-indigo-400 dark:text-red-400 flex-shrink-0" />
                              <span className="font-bold text-sm text-gray-800 dark:text-white">{r.room_number}</span>
                            </div>
                            {r.room_type && (
                              <p className="text-[10px] text-gray-400 mt-0.5 ml-6">{r.room_type}</p>
                            )}
                          </button>
                        ))}
                        {rooms.length === 0 && (
                          <p className="col-span-2 text-sm text-gray-400 py-4 text-center">No active rooms found.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step: Type ── */}
              {!success && step === 'type' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-[#b1a7a6] mb-4">
                    Room <span className="font-bold text-gray-800 dark:text-white">{selectedRoom}</span>
                    {roomInfo?.room_type ? ` · ${roomInfo.room_type}` : ''}
                  </p>
                  
                  {/* Periodic option */}
                  <button
                    type="button"
                    onClick={() => setBookingType('periodic')}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all group ${
                      bookingType === 'periodic'
                        ? 'border-indigo-500 dark:border-red-500 bg-indigo-50 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-[#3d4951] hover:border-indigo-300 dark:hover:border-red-600/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        bookingType === 'periodic' ? 'bg-indigo-100 dark:bg-red-800/40' : 'bg-gray-100 dark:bg-white/10'
                      }`}>
                        <Calendar className="w-4 h-4 text-indigo-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-800 dark:text-white">Periodic</p>
                        <p className="text-xs text-gray-500 dark:text-[#b1a7a6] mt-0.5">
                          Pick from standard KUET class periods. Shows available blank slots only.
                        </p>
                        <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 bg-indigo-100 dark:bg-red-900/30 text-indigo-600 dark:text-red-400 rounded-full font-medium">
                          Affects routine view
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Continuous option */}
                  <button
                    type="button"
                    onClick={() => setBookingType('continuous')}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all group ${
                      bookingType === 'continuous'
                        ? 'border-indigo-500 dark:border-red-500 bg-indigo-50 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-[#3d4951] hover:border-indigo-300 dark:hover:border-red-600/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        bookingType === 'continuous' ? 'bg-indigo-100 dark:bg-red-800/40' : 'bg-gray-100 dark:bg-white/10'
                      }`}>
                        <Zap className="w-4 h-4 text-indigo-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-800 dark:text-white">Continuous</p>
                        <p className="text-xs text-gray-500 dark:text-[#b1a7a6] mt-0.5">
                          Set any custom start & end time. Does <strong>not</strong> change the class routine.
                        </p>
                        <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full font-medium">
                          Routine unchanged
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* ── Step: Configure ── */}
              {!success && step === 'configure' && (
                <div className="space-y-5">
                  {/* Periodic: period chips */}
                  {bookingType === 'periodic' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={labelCls}>Select Available Period</label>
                        <span className="text-[10px] text-gray-400">
                          {loadingPeriods ? 'Checking…' : `${availableCount} available`}
                        </span>
                      </div>

                      {loadingPeriods ? (
                        <div className="flex items-center gap-2 py-8 justify-center text-gray-400">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm">Checking room availability…</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {periods.map((p, idx) => {
                            const afterBreak = BREAK_AFTER.includes(p.id - 1);
                            return (
                              <div key={p.id}>
                                {afterBreak && <div className="my-2 border-t border-dashed border-gray-200 dark:border-[#3d4951]" />}
                                <button
                                  type="button"
                                  disabled={!p.available}
                                  onClick={() => setSelectedPeriod(p)}
                                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                                    !p.available
                                      ? 'border-gray-100 dark:border-[#3d4951]/40 bg-gray-50 dark:bg-white/5 opacity-50 cursor-not-allowed'
                                      : selectedPeriod?.id === p.id
                                        ? 'border-indigo-500 dark:border-red-500 bg-indigo-50 dark:bg-red-900/20'
                                        : 'border-gray-200 dark:border-[#3d4951] hover:border-indigo-300 dark:hover:border-red-500/50 bg-white dark:bg-transparent'
                                  }`}
                                >
                                  <span className={`text-xs font-bold w-6 text-center ${
                                    p.available ? 'text-indigo-500 dark:text-red-400' : 'text-gray-300'
                                  }`}>P{p.id}</span>
                                  <span className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-white">{p.label}</span>
                                  {!p.available && (
                                    <span className="text-[10px] text-red-400 font-medium">Booked</span>
                                  )}
                                  {p.available && selectedPeriod?.id === p.id && (
                                    <CheckCircle2 className="w-4 h-4 text-indigo-500 dark:text-red-400" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                          {periods.length === 0 && !loadingPeriods && (
                            <p className="text-sm text-gray-400 text-center py-6">No periods available</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Continuous: time pickers */}
                  {bookingType === 'continuous' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Start Time</label>
                          <TimePicker
                            value={startTime}
                            onChange={e => setStartTime(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>End Time</label>
                          <TimePicker
                            value={endTime}
                            onChange={e => setEndTime(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-600/20 text-xs text-amber-700 dark:text-amber-400">
                        ⚡ Continuous bookings do <strong>not</strong> modify the class routine. They only block the room and appear on the TV display.
                      </div>
                    </div>
                  )}

                  {/* Label / Purpose */}
                  <div>
                    <label className={labelCls}>Label / Purpose <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                      placeholder={bookingType === 'periodic' ? 'e.g. Extra Class, Exam, Lab' : 'e.g. Department Meeting, Seminar'}
                      className={inputCls}
                      maxLength={80}
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step: Confirm ── */}
              {!success && step === 'confirm' && (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-red-900/20 dark:to-red-800/10 border border-indigo-100 dark:border-red-700/30">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-indigo-500 dark:text-red-400" />
                      Booking Summary
                    </h3>
                    <dl className="space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-[#b1a7a6]">Room</dt>
                        <dd className="font-bold text-gray-800 dark:text-white">
                          {selectedRoom}{roomInfo?.room_type ? ` (${roomInfo.room_type})` : ''}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-[#b1a7a6]">Date</dt>
                        <dd className="font-bold text-gray-800 dark:text-white">{formatDate(bookingDate)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-[#b1a7a6]">Type</dt>
                        <dd className="font-bold text-gray-800 dark:text-white capitalize">{bookingType}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-[#b1a7a6]">Time</dt>
                        <dd className="font-bold text-gray-800 dark:text-white">
                          {bookingType === 'periodic'
                            ? `${formatTime12(selectedPeriod!.start)} – ${formatTime12(selectedPeriod!.end)}`
                            : `${formatTime12(startTime)} – ${formatTime12(endTime)}`}
                        </dd>
                      </div>
                      {label.trim() && (
                        <div className="flex justify-between">
                          <dt className="text-gray-500 dark:text-[#b1a7a6]">Label</dt>
                          <dd className="font-bold text-gray-800 dark:text-white">{label}</dd>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-indigo-100 dark:border-red-700/30">
                        <dt className="text-gray-500 dark:text-[#b1a7a6]">Routine</dt>
                        <dd className={`font-bold text-xs px-2 py-0.5 rounded-full ${
                          bookingType === 'continuous'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        }`}>
                          {bookingType === 'continuous' ? 'NOT changed' : 'Not changed (date-scoped)'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Footer / Actions ── */}
            {!success && (
              <div className="px-6 py-4 border-t border-gray-100 dark:border-[#3d4951] flex items-center justify-between gap-3 flex-shrink-0">
                {/* Back */}
                <button
                  type="button"
                  onClick={() => {
                    if (step === 'room') onClose();
                    else if (step === 'type') setStep('room');
                    else if (step === 'configure') setStep('type');
                    else if (step === 'confirm') setStep('configure');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-gray-600 dark:text-[#b1a7a6] hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors"
                >
                  ← {step === 'room' ? 'Cancel' : 'Back'}
                </button>

                {/* Next / Confirm */}
                {step === 'room' && (
                  <button
                    type="button"
                    onClick={goToType}
                    disabled={!selectedRoom}
                    className={btnPrimary}
                  >
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {step === 'type' && (
                  <button type="button" onClick={goToConfigure} className={btnPrimary}>
                    Configure <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {step === 'configure' && (
                  <button
                    type="button"
                    onClick={goToConfirm}
                    disabled={loadingPeriods}
                    className={btnPrimary}
                  >
                    Review <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {step === 'confirm' && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={btnPrimary}
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Booking…</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Confirm Booking</>
                    )}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
