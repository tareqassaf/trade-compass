
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE account_type AS ENUM ('live', 'demo', 'prop');
CREATE TYPE trade_side AS ENUM ('long', 'short');
CREATE TYPE order_type AS ENUM ('market', 'limit', 'stop');
CREATE TYPE trade_result AS ENUM ('win', 'loss', 'breakeven', 'open');
CREATE TYPE asset_class AS ENUM ('forex', 'crypto', 'index', 'stock', 'commodity');
CREATE TYPE mood_type AS ENUM ('confident', 'nervous', 'disciplined', 'impulsive', 'focused', 'stressed');

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  timezone TEXT DEFAULT 'UTC',
  base_currency TEXT DEFAULT 'USD',
  default_risk_percent NUMERIC(5,2) DEFAULT 1.00,
  default_account_type account_type DEFAULT 'demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Instruments table
CREATE TABLE public.instruments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT,
  asset_class asset_class NOT NULL,
  tick_value NUMERIC(10,4),
  tick_size NUMERIC(10,6),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- Strategies table
CREATE TABLE public.strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  checklist TEXT[], -- Array of checklist items
  example_screenshots TEXT[], -- Array of screenshot URLs
  typical_rr_min NUMERIC(5,2),
  typical_rr_max NUMERIC(5,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  start_time_utc TIME,
  end_time_utc TIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Tags table
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  color TEXT, -- Hex color for UI
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, label)
);

-- Trades table (main entity)
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Timing
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  trading_day DATE NOT NULL,
  
  -- References
  instrument_id UUID REFERENCES public.instruments(id) ON DELETE RESTRICT NOT NULL,
  strategy_id UUID REFERENCES public.strategies(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  
  -- Trade setup
  account_type account_type NOT NULL DEFAULT 'demo',
  side trade_side NOT NULL,
  order_type order_type NOT NULL,
  size_lots NUMERIC(10,4) NOT NULL,
  risk_percent NUMERIC(5,2),
  
  -- Price levels (planned)
  planned_entry_low NUMERIC(12,6),
  planned_entry_high NUMERIC(12,6),
  
  -- Execution prices
  entry_price NUMERIC(12,6) NOT NULL,
  stop_loss_price NUMERIC(12,6) NOT NULL,
  tp1_price NUMERIC(12,6),
  tp2_price NUMERIC(12,6),
  tp3_price NUMERIC(12,6),
  exit_price NUMERIC(12,6),
  
  -- Points (distance calculations)
  sl_points NUMERIC(10,4),
  tp1_points NUMERIC(10,4),
  tp2_points NUMERIC(10,4),
  tp3_points NUMERIC(10,4),
  
  -- Performance metrics
  pnl_amount NUMERIC(12,2),
  pnl_points NUMERIC(10,4),
  pnl_percent NUMERIC(7,4),
  r_multiple NUMERIC(7,4),
  mfe_points NUMERIC(10,4), -- Max Favorable Excursion
  mae_points NUMERIC(10,4), -- Max Adverse Excursion
  
  -- Result
  result trade_result NOT NULL DEFAULT 'open',
  
  -- Quality tracking
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  execution_errors TEXT,
  
  -- Notes
  pre_trade_plan TEXT,
  post_trade_review TEXT,
  notes TEXT,
  
  -- Media
  screenshot_url TEXT,
  
  -- Balance tracking
  equity_after_trade NUMERIC(12,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trade tags junction table (many-to-many)
CREATE TABLE public.trade_tags (
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (trade_id, tag_id)
);

-- Journal entries table
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trading_day DATE NOT NULL,
  text TEXT NOT NULL,
  mood mood_type,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, trading_day)
);

-- Create indexes for performance
CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_trading_day ON public.trades(trading_day);
CREATE INDEX idx_trades_opened_at ON public.trades(opened_at);
CREATE INDEX idx_trades_instrument_id ON public.trades(instrument_id);
CREATE INDEX idx_trades_strategy_id ON public.trades(strategy_id);
CREATE INDEX idx_trades_session_id ON public.trades(session_id);
CREATE INDEX idx_trades_result ON public.trades(result);
CREATE INDEX idx_instruments_user_id ON public.instruments(user_id);
CREATE INDEX idx_strategies_user_id ON public.strategies(user_id);
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_tags_user_id ON public.tags(user_id);
CREATE INDEX idx_journal_entries_user_id ON public.journal_entries(user_id);
CREATE INDEX idx_journal_entries_trading_day ON public.journal_entries(trading_day);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON public.strategies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for instruments
CREATE POLICY "Users can view own instruments" ON public.instruments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own instruments" ON public.instruments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own instruments" ON public.instruments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own instruments" ON public.instruments
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for strategies
CREATE POLICY "Users can view own strategies" ON public.strategies
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strategies" ON public.strategies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategies" ON public.strategies
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategies" ON public.strategies
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for sessions
CREATE POLICY "Users can view own sessions" ON public.sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON public.sessions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for tags
CREATE POLICY "Users can view own tags" ON public.tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags" ON public.tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags" ON public.tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" ON public.tags
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for trades
CREATE POLICY "Users can view own trades" ON public.trades
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades" ON public.trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades" ON public.trades
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades" ON public.trades
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for trade_tags (check ownership through trade)
CREATE POLICY "Users can view own trade_tags" ON public.trade_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trades
      WHERE trades.id = trade_tags.trade_id
      AND trades.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own trade_tags" ON public.trade_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trades
      WHERE trades.id = trade_tags.trade_id
      AND trades.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own trade_tags" ON public.trade_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.trades
      WHERE trades.id = trade_tags.trade_id
      AND trades.user_id = auth.uid()
    )
  );

-- RLS Policies for journal_entries
CREATE POLICY "Users can view own journal entries" ON public.journal_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries" ON public.journal_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries" ON public.journal_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries" ON public.journal_entries
  FOR DELETE USING (auth.uid() = user_id);
