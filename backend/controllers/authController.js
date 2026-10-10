/* ============================================
   AUTH CONTROLLER
   Handles: Register, Login, Profile
   ============================================ */

const bcrypt        = require('bcryptjs');
const crypto        = require('crypto');
const { query, queryOne, transaction } = require('../config/db');
const generateToken = require('../utils/generateToken');
const { sendPasswordResetEmail } = require('../utils/email');

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

let resetTableReady = false;
const ensureResetTable = async () => {
  if (resetTableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_password_reset_user (user_id),
      INDEX idx_password_reset_token (token_hash),
      CONSTRAINT fk_password_reset_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);
  resetTableReady = true;
};

/* ============================================
   POST /api/auth/register
   ============================================ */
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    /* ---- Validate required fields ---- */
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required.',
      });
    }

    if (!isValidEmail(email.toLowerCase().trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.',
      });
    }

    /* ---- Check if email already exists ---- */
    const existingUser = await queryOne(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    /* ---- Hash password ---- */
    const salt           = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    /* ---- Insert user into database ---- */
    const result = await query(
      `INSERT INTO users (name, email, password, phone)
       VALUES (?, ?, ?, ?)`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        hashedPassword,
        phone ? String(phone).trim() : '',
      ]
    );

    const userId = result.insertId;

    /* ---- Generate token ---- */
    const token = generateToken(userId, 'user');

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: {
        id:    userId,
        name:  name.trim(),
        email: email.toLowerCase().trim(),
        role:  'user',
        phone: phone ? String(phone).trim() : '',
      },
    });

  } catch (error) {
    next(error);
  }
};

/* ============================================
   POST /api/auth/login
   ============================================ */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    /* ---- Validate fields ---- */
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    /* ---- Find user by email (include password) ---- */
    const user = await queryOne(
      'SELECT id, name, email, password, role, phone, address, city, is_active FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    /* ---- Check if account is active ---- */
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account deactivated. Contact support.',
      });
    }

    /* ---- Compare password ---- */
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    /* ---- Generate token ---- */
    const token = generateToken(user.id, user.role);

    /* ---- Remove password from response ---- */
    delete user.password;

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user,
    });

  } catch (error) {
    next(error);
  }
};

/* ============================================
   GET /api/auth/profile
   ============================================ */
const getProfile = async (req, res, next) => {
  try {
    const user = await queryOne(
      `SELECT id, name, email, role, phone,
              address, city, country, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {
    next(error);
  }
};

/* ============================================
   PUT /api/auth/profile
   ============================================ */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address, city, country, currentPassword, newPassword } = req.body;

    /* ---- If changing password, verify current ---- */
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to set a new password.',
        });
      }

      /* ---- Get user with password ---- */
      const userWithPass = await queryOne(
        'SELECT password FROM users WHERE id = ?',
        [req.user.id]
      );

      const isMatch = await bcrypt.compare(currentPassword, userWithPass.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect.',
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 8 characters.',
        });
      }

      /* ---- Hash new password ---- */
      const salt      = await bcrypt.genSalt(12);
      const hashed    = await bcrypt.hash(newPassword, salt);

      await query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashed, req.user.id]
      );
    }

    /* ---- Update profile fields ---- */
    await query(
      `UPDATE users
       SET name    = COALESCE(NULLIF(?, ''), name),
           phone   = COALESCE(NULLIF(?, ''), phone),
           address = COALESCE(NULLIF(?, ''), address),
           city    = COALESCE(NULLIF(?, ''), city),
           country = COALESCE(NULLIF(?, ''), country)
       WHERE id = ?`,
      [name || '', phone ? String(phone).trim() : '', address || '', city || '', country || '', req.user.id]
    );

    /* ---- Return updated user ---- */
    const updated = await queryOne(
      'SELECT id, name, email, role, phone, address, city, country FROM users WHERE id = ?',
      [req.user.id]
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user:    updated,
    });

  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    await ensureResetTable();

    const user = await queryOne(
      'SELECT id, email, is_active FROM users WHERE email = ?',
      [email]
    );

    const response = {
      success: true,
      message: 'If an account exists for that email, password reset instructions are ready.',
    };

    if (!user || !user.is_active) {
      return res.status(200).json(response);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);

    await query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = ? AND used_at IS NULL`,
      [user.id]
    );

    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
      [user.id, tokenHash]
    );

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5500';
    const resetUrl = new URL('/pages/reset-password.html', frontendBase);
    resetUrl.searchParams.set('token', token);

    void sendPasswordResetEmail({ to: user.email, resetUrl: resetUrl.toString() }).catch(async (emailError) => {
      await query(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE token_hash = ? AND used_at IS NULL`,
        [tokenHash]
      ).catch(() => {});
      console.error('Password reset email delivery failed:', emailError.code || 'SMTP_ERROR');
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required.',
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.',
      });
    }

    await ensureResetTable();

    const tokenHash = hashResetToken(token);
    const reset = await queryOne(
      `SELECT prt.id, prt.user_id
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = ?
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()
         AND u.is_active = 1`,
      [tokenHash]
    );

    if (!reset) {
      return res.status(400).json({
        success: false,
        message: 'Reset link is invalid or expired.',
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    await transaction(async (connection) => {
      const [claim] = await connection.execute(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE id = ? AND used_at IS NULL AND expires_at > NOW()`,
        [reset.id]
      );

      if (claim.affectedRows !== 1) {
        const error = new Error('Reset link is invalid or expired.');
        error.statusCode = 400;
        throw error;
      }

      const [userUpdate] = await connection.execute(
        'UPDATE users SET password = ? WHERE id = ? AND is_active = 1',
        [hashedPassword, reset.user_id]
      );

      if (userUpdate.affectedRows !== 1) {
        const error = new Error('Reset link is invalid or expired.');
        error.statusCode = 400;
        throw error;
      }
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now sign in.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getProfile, updateProfile, forgotPassword, resetPassword };
