#!/bin/bash
set -e

nginx

exec python /home/$MAMBA_USER/main.py
 