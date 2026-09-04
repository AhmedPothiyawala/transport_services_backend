import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

const memoryParties: any[] = [];

export const createParty = async (req: AuthRequest, res: Response) => {
  const { name, mobile, gstin, address } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ status: false, message: 'Party name is required' });
  }

  if (!mobile || !mobile.trim()) {
    return res.status(400).json({ status: false, message: 'Mobile number is required' });
  }

  const cleanMobile = mobile.toString().replace(/\D/g, '');
  if (cleanMobile.length !== 10) {
    return res.status(400).json({ status: false, message: 'Invalid mobile number format. Party mobile number must be exactly 10 digits.' });
  }

  const cleanName = name.trim();
  const cleanGstin = gstin ? gstin.trim() : '';
  const cleanAddress = address ? address.trim() : '';

  try {
    const dbRes = await query(
      'INSERT INTO parties (name, mobile, gstin, address) VALUES ($1, $2, $3, $4) RETURNING *',
      [cleanName, cleanMobile, cleanGstin, cleanAddress]
    );

    return res.json({
      status: true,
      message: 'Party added successfully',
      party: dbRes.rows[0],
    });
  } catch (err: any) {
    // Unique violation on mobile column (PostgreSQL Error Code 23505)
    if (err && (err.code === '23505' || (err.message && err.message.includes('unique')))) {
      return res.status(400).json({
        status: false,
        message: 'Party with this mobile number already exists.',
      });
    }

    // Fallback mode logic
    const existing = memoryParties.find(p => p.mobile === cleanMobile);
    if (existing) {
      return res.status(400).json({
        status: false,
        message: 'Party with this mobile number already exists.',
      });
    }

    const newParty = {
      id: memoryParties.length + 1,
      name: cleanName,
      mobile: cleanMobile,
      gstin: cleanGstin,
      address: cleanAddress,
      created_at: new Date().toISOString(),
    };
    memoryParties.push(newParty);

    return res.json({
      status: true,
      message: 'Party added successfully',
      party: newParty,
    });
  }
};

export const getParties = async (req: AuthRequest, res: Response) => {
  try {
    const dbRes = await query('SELECT * FROM parties ORDER BY name ASC');
    return res.json({
      status: true,
      parties: dbRes.rows,
    });
  } catch (err) {
    return res.json({
      status: true,
      parties: [...memoryParties].sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
};
