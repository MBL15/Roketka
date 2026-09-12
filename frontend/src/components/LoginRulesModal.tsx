import { useState } from 'react';
import type { GameSetup, ThemeSetup } from '../api/types';
import { persistLoginRulesDismissed } from '../utils/loginRules';
import { RulesModal } from './RulesModal';

interface LoginRulesModalProps {
  open: boolean;
  playerId: number;
  setup: GameSetup;
  theme: ThemeSetup;
  onClose: () => void;
}

/** Правила при входе: показываются каждый раз, пока игрок не отметит «больше не показывать». */
export function LoginRulesModal({ open, playerId, setup, theme, onClose }: LoginRulesModalProps): JSX.Element {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const close = () => {
    if (dontShowAgain) {
      persistLoginRulesDismissed(playerId);
    }
    onClose();
  };

  return (
    <RulesModal
      open={open}
      onClose={close}
      setup={setup}
      theme={theme}
      closeOnBackdrop={false}
      intro="Кратко о том, как устроена бонусная crash-игра «Воздушный шар»."
      footer={
        <div className="login-rules__foot">
          <label className="login-rules__dismiss">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
            />
            <span>Больше не показывать</span>
          </label>
          <button type="button" className="btn btn--primary" onClick={close}>
            Понятно, играть
          </button>
        </div>
      }
    />
  );
}
