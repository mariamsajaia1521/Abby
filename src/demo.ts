import { addDays, dateKey } from './dates';
import { emptyState, type State } from './types';

// Demonstration data never enters the account API or the user's saved records.
export function createDemoState(): State {
  const now = new Date();
  const day = (offset: number) => dateKey(addDays(now, offset));
  return {
    ...emptyState(),
    dog: { name: 'აბი', breed: 'კავალერ კინგ ჩარლზ სპანიელი', gender: 'female', species: 'ძაღლი', age: '', birthDate: '2023-06-15', sterilization: 'yes', allergies: 'ინფორმაცია დასაზუსტებელია', createdAt: now.getTime() },
    vet: { name: 'ნინო · დემო ვეტერინარი', clinic: 'ზრუნვის კლინიკა · მაგალითი', phone: '', emergencyPhone: '', address: '', email: '', notes: 'სადემონსტრაციო ბარათი. აქ თქვენი ვეტერინარის ინფორმაცია გამოჩნდება.' },
    weightEntries: [
      { id: 'demo-weight-1', date: day(-60), weightKg: 7.6, timestamp: addDays(now, -60).getTime() },
      { id: 'demo-weight-2', date: day(-30), weightKg: 7.8, timestamp: addDays(now, -30).getTime() },
      { id: 'demo-weight-3', date: day(-3), weightKg: 7.7, timestamp: addDays(now, -3).getTime() }
    ],
    healthRecords: [
      { id: 'demo-health-1', type: 'visit', title: 'პროფილაქტიკური ვიზიტი', date: day(-3), note: 'სადემონსტრაციო ჩანაწერი — ვიზიტის დეტალები და ვეტერინარის შენიშვნები აქ ინახება.' },
      { id: 'demo-health-2', type: 'vaccination', title: 'ვაქცინაციის ჩანაწერი', date: day(-24), note: 'მაგალითი — ვაქცინის დასახელება და დოკუმენტი შეგიძლიათ ჩანაწერს დაურთოთ.' },
      { id: 'demo-health-3', type: 'analysis', title: 'ლაბორატორიული კვლევა', date: day(-45), note: 'სადემონსტრაციო ჩანაწერი. რეალური კვლევის შედეგები აქ არ არის მოცემული.' }
    ],
    reminders: [
      { id: 'demo-plan-1', title: 'ვეტერინართან ვიზიტი', category: 'appointment', date: day(2), notes: 'დემოს მაგალითი — ვიზიტის დეტალები.', status: 'open', recurrence: 'none', createdAt: now.getTime() },
      { id: 'demo-plan-2', title: 'წონის გაზომვა', category: 'followup', date: day(6), notes: 'მონაცემების განახლების მაგალითი.', status: 'open', recurrence: 'monthly', createdAt: now.getTime() },
      { id: 'demo-plan-3', title: 'პრევენციული ზრუნვა', category: 'prevention', date: day(16), notes: 'სადემონსტრაციო შეხსენება — პერიოდულობას ვეტერინართან ათანხმებთ.', status: 'open', recurrence: 'none', createdAt: now.getTime() }
    ]
  };
}
