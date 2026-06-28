import Dexie from 'dexie';

export const db = new Dexie('DonationDB');
db.version(1).stores({
  transactions: '++id, institution_id, donor_name, amount, status' 
});