<?php

namespace App\Service;

use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

final class AppMailer
{
    public function __construct(
        private readonly MailerInterface $mailer,
    ) {
    }

    public function sendEmailConfirmation(string $toEmail, string $toName, string $confirmUrl): bool
    {
        return $this->send(
            $toEmail,
            $toName,
            'Confirma adresa de email - Ghiseul Cetateanului',
            <<<TEXT
                Buna, {$toName}!

                Pentru a activa contul tau, confirma adresa de email accesand linkul de mai jos:
                {$confirmUrl}

                Linkul este valabil 24 de ore. Daca nu ai creat acest cont, poti ignora acest mesaj.
                TEXT,
        );
    }

    public function sendPasswordReset(string $toEmail, string $toName, string $resetUrl): bool
    {
        return $this->send(
            $toEmail,
            $toName,
            'Resetare parola - Ghiseul Cetateanului',
            <<<TEXT
                Buna, {$toName}!

                Am primit o cerere de resetare a parolei contului tau. Acceseaza linkul de mai jos pentru a alege o parola noua:
                {$resetUrl}

                Linkul este valabil 30 de minute. Daca nu ai solicitat resetarea parolei, poti ignora acest mesaj - parola ta ramane neschimbata.
                TEXT,
        );
    }

    private function send(string $toEmail, string $toName, string $subject, string $textBody): bool
    {
        $fromAddress = $_ENV['MAILER_FROM_ADDRESS'] ?? 'no-reply@ghiseulcetateanului.ro';
        $fromName = $_ENV['MAILER_FROM_NAME'] ?? 'Ghiseul Cetateanului';

        $email = (new Email())
            ->from(sprintf('%s <%s>', $fromName, $fromAddress))
            ->to(sprintf('%s <%s>', $toName !== '' ? $toName : $toEmail, $toEmail))
            ->subject($subject)
            ->text($textBody);

        try {
            $this->mailer->send($email);

            return true;
        } catch (TransportExceptionInterface $exception) {
            error_log('Trimiterea emailului a esuat pentru '.$toEmail.': '.$exception->getMessage());

            return false;
        }
    }
}
