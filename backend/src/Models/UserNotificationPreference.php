<?php

declare(strict_types=1);

namespace CarbonTrack\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $user_id
 * @property string $category
 * @property bool $email_enabled
 * @property string $created_at
 * @property string $updated_at
 */
class UserNotificationPreference extends Model
{
    protected $table = 'user_notification_preferences';

    protected $fillable = [
        'user_id',
        'category',
        'email_enabled',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'email_enabled' => 'boolean',
    ];
}

