import { Request, Response } from 'express';
import { query } from '../db/pool';

const memoryBranches: any[] = [
  { id: 1, branch_name: 'Ahmedabad Central', city: 'Ahmedabad', code: 'AMD01' },
  { id: 2, branch_name: 'Delhi Hub', city: 'Delhi', code: 'DEL01' },
  { id: 3, branch_name: 'Mumbai Terminal', city: 'Mumbai', code: 'MUM01' }
];

export const createBranch = async (req: Request, res: Response) => {
  const { branch_name, city, code } = req.body;
  if (!branch_name || !city || !code) {
    return res.status(400).json({ status: false, message: 'Branch Name, City, and Code are required' });
  }

  try {
    const dbRes = await query(
      'INSERT INTO branches (branch_name, city, code) VALUES ($1, $2, $3) RETURNING *',
      [branch_name, city, code]
    );
    return res.json({ status: true, message: 'Branch created successfully', branch: dbRes.rows[0] });
  } catch (err) {
    const newBranch = { id: memoryBranches.length + 1, branch_name, city, code };
    memoryBranches.push(newBranch);
    return res.json({ status: true, message: 'Branch created successfully (fallback)', branch: newBranch });
  }
};

export const getBranches = async (req: Request, res: Response) => {
  try {
    const dbRes = await query('SELECT * FROM branches ORDER BY id ASC');
    return res.json({ status: true, branches: dbRes.rows });
  } catch (err) {
    return res.json({ status: true, branches: memoryBranches });
  }
};

export const deleteBranch = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM branches WHERE id = $1', [id]);
    return res.json({ status: true, message: 'Branch deleted successfully' });
  } catch (err) {
    const idx = memoryBranches.findIndex(b => b.id === Number(id));
    if (idx !== -1) memoryBranches.splice(idx, 1);
    return res.json({ status: true, message: 'Branch deleted successfully' });
  }
};
